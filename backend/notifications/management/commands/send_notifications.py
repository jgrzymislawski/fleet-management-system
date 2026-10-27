from datetime import timedelta

from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.utils import timezone

from organizations.models import (
    CompanyAccess,
    Organization,
    OrganizationMembership,
)

from vehicles.models import (
    Vehicle,
    VehicleDocument,
)

from notifications.models import (
    NotificationLog,
    NotificationPreference,
    NotificationSettings,
)


class Command(BaseCommand):
    help = "Wysyła powiadomienia o zbliżających się terminach."

    def handle(self, *args, **options):
        today = timezone.localdate()

        sent_count = 0

        organizations = Organization.objects.filter(
            is_active=True,
        )

        for organization in organizations:
            settings_object, created = (
                NotificationSettings.objects.get_or_create(
                    organization=organization,
                )
            )

            notification_days = self.get_notification_days(
                settings_object
            )

            for days_before in notification_days:
                target_date = today + timedelta(
                    days=days_before
                )

                if settings_object.insurance_enabled:
                    sent_count += (
                        self.process_vehicle_notifications(
                            organization=organization,
                            notification_type="insurance",
                            date_field="insurance_expiry_date",
                            target_date=target_date,
                            days_before=days_before,
                        )
                    )

                if settings_object.inspection_enabled:
                    sent_count += (
                        self.process_vehicle_notifications(
                            organization=organization,
                            notification_type="inspection",
                            date_field="inspection_expiry_date",
                            target_date=target_date,
                            days_before=days_before,
                        )
                    )

                if settings_object.documents_enabled:
                    sent_count += (
                        self.process_document_notifications(
                            organization=organization,
                            target_date=target_date,
                            days_before=days_before,
                        )
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f"Zakończono. Wysłano wiadomości: {sent_count}"
            )
        )

    def get_notification_days(
        self,
        settings_object,
    ):
        days = []

        if settings_object.notify_30_days:
            days.append(30)

        if settings_object.notify_14_days:
            days.append(14)

        if settings_object.notify_7_days:
            days.append(7)

        if settings_object.notify_1_day:
            days.append(1)

        return days

    def get_recipients(
        self,
        organization,
        vehicle,
        notification_type,
    ):
        memberships = (
            OrganizationMembership.objects
            .select_related("user")
            .filter(
                organization=organization,
                user__is_active=True,
            )
        )

        recipients = []

        for membership in memberships:
            user = membership.user

            if not user.email:
                continue

            preference, created = (
                NotificationPreference.objects.get_or_create(
                    user=user,
                )
            )

            if not preference.email_enabled:
                continue

            if (
                notification_type == "insurance"
                and not preference.insurance_enabled
            ):
                continue

            if (
                notification_type == "inspection"
                and not preference.inspection_enabled
            ):
                continue

            if (
                notification_type == "document"
                and not preference.documents_enabled
            ):
                continue

            if membership.role == "admin":
                recipients.append(user)
                continue

            if vehicle.company_id is None:
                continue

            if not vehicle.company.is_active:
                continue

            has_access = CompanyAccess.objects.filter(
                membership=membership,
                company=vehicle.company,
                company__is_active=True,
            ).exists()

            if has_access:
                recipients.append(user)

        return recipients

    def process_vehicle_notifications(
        self,
        organization,
        notification_type,
        date_field,
        target_date,
        days_before,
    ):
        filters = {
            "organization": organization,
            date_field: target_date,
        }

        vehicles = (
            Vehicle.objects
            .select_related("company")
            .filter(**filters)
        )

        sent_count = 0

        for vehicle in vehicles:
            if (
                vehicle.company
                and not vehicle.company.is_active
            ):
                continue

            recipients = self.get_recipients(
                organization=organization,
                vehicle=vehicle,
                notification_type=notification_type,
            )

            for user in recipients:
                expiry_date = getattr(
                    vehicle,
                    date_field,
                )

                if notification_type == "insurance":
                    subject = (
                        f"Flotivo - polisa OC pojazdu "
                        f"{vehicle.registration_number}"
                    )

                    event_name = "Polisa OC"

                else:
                    subject = (
                        f"Flotivo - przegląd techniczny pojazdu "
                        f"{vehicle.registration_number}"
                    )

                    event_name = "Przegląd techniczny"

                sent = self.send_notification(
                    organization=organization,
                    user=user,
                    vehicle=vehicle,
                    notification_type=notification_type,
                    source_id=vehicle.id,
                    expiry_date=expiry_date,
                    days_before=days_before,
                    subject=subject,
                    event_name=event_name,
                )

                if sent:
                    sent_count += 1

        return sent_count

    def process_document_notifications(
        self,
        organization,
        target_date,
        days_before,
    ):
        documents = (
            VehicleDocument.objects
            .select_related(
                "vehicle",
                "vehicle__company",
            )
            .filter(
                vehicle__organization=organization,
                expiry_date=target_date,
            )
        )

        sent_count = 0

        for document in documents:
            vehicle = document.vehicle

            if (
                vehicle.company
                and not vehicle.company.is_active
            ):
                continue

            recipients = self.get_recipients(
                organization=organization,
                vehicle=vehicle,
                notification_type="document",
            )

            for user in recipients:
                document_name = (
                    document.get_document_type_display()
                )

                subject = (
                    f"Flotivo - wygasający dokument "
                    f"{vehicle.registration_number}"
                )

                sent = self.send_notification(
                    organization=organization,
                    user=user,
                    vehicle=vehicle,
                    notification_type="document",
                    source_id=document.id,
                    expiry_date=document.expiry_date,
                    days_before=days_before,
                    subject=subject,
                    event_name=document_name,
                )

                if sent:
                    sent_count += 1

        return sent_count

    def send_notification(
        self,
        organization,
        user,
        vehicle,
        notification_type,
        source_id,
        expiry_date,
        days_before,
        subject,
        event_name,
    ):
        already_sent = NotificationLog.objects.filter(
            notification_type=notification_type,
            user=user,
            source_id=source_id,
            expiry_date=expiry_date,
            days_before=days_before,
        ).exists()

        if already_sent:
            return False

        message = (
            f"Cześć {user.username},\n\n"
            f"Flotivo przypomina o zbliżającym się terminie.\n\n"
            f"{event_name}\n"
            f"Pojazd: {vehicle.brand} {vehicle.model}\n"
            f"Numer rejestracyjny: "
            f"{vehicle.registration_number}\n"
            f"Termin: {expiry_date.strftime('%d.%m.%Y')}\n"
            f"Pozostało: {days_before} dni\n\n"
            f"Zaloguj się do Flotivo, aby sprawdzić "
            f"szczegóły pojazdu.\n\n"
            f"Flotivo"
        )

        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=None,
                recipient_list=[
                    user.email,
                ],
                fail_silently=False,
            )
        except Exception as error:
            self.stderr.write(
                self.style.ERROR(
                    f"Nie udało się wysłać wiadomości "
                    f"do {user.email}: {error}"
                )
            )

            return False

        NotificationLog.objects.create(
            notification_type=notification_type,
            organization=organization,
            user=user,
            vehicle=vehicle,
            source_id=source_id,
            expiry_date=expiry_date,
            days_before=days_before,
            recipient_email=user.email,
            subject=subject,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Wysłano: {subject} -> {user.email}"
            )
        )

        return True