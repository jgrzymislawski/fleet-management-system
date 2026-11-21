import logging

from datetime import timedelta

from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.db import IntegrityError, transaction
from django.utils import timezone

from drivers.models import Driver
from notifications.models import (
    NotificationLog,
    NotificationPreference,
    NotificationSettings,
)
from organizations.models import (
    CompanyAccess,
    Organization,
    OrganizationMembership,
)
from vehicles.models import (
    Vehicle,
    VehicleDocument,
)


logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Wysyła powiadomienia e-mail o zbliżających się terminach."

    def handle(self, *args, **options):
        today = timezone.localdate()
        sent_count = 0

        organizations = (
            Organization.objects
            .filter(
                is_active=True,
            )
            .order_by(
                "id"
            )
        )

        for organization in organizations:
            settings, _ = (
                NotificationSettings.objects
                .get_or_create(
                    organization=organization,
                )
            )

            notification_days = (
                self.get_notification_days(
                    settings
                )
            )

            if not notification_days:
                continue

            if settings.insurance_enabled:
                sent_count += (
                    self.process_vehicle_dates(
                        organization=organization,
                        notification_type="insurance",
                        date_field=(
                            "insurance_expiry_date"
                        ),
                        event_name="Polisa OC",
                        notification_days=(
                            notification_days
                        ),
                        today=today,
                    )
                )

            if settings.inspection_enabled:
                sent_count += (
                    self.process_vehicle_dates(
                        organization=organization,
                        notification_type="inspection",
                        date_field=(
                            "inspection_expiry_date"
                        ),
                        event_name=(
                            "Przegląd techniczny"
                        ),
                        notification_days=(
                            notification_days
                        ),
                        today=today,
                    )
                )

            if settings.documents_enabled:
                sent_count += (
                    self.process_documents(
                        organization=organization,
                        notification_days=(
                            notification_days
                        ),
                        today=today,
                    )
                )

            if settings.driver_license_enabled:
                sent_count += (
                    self.process_driver_dates(
                        organization=organization,
                        notification_type=(
                            "driver_license"
                        ),
                        date_field=(
                            "license_expiry_date"
                        ),
                        event_name="Prawo jazdy",
                        preference_field=(
                            "driver_license_enabled"
                        ),
                        notification_days=(
                            notification_days
                        ),
                        today=today,
                    )
                )

            if settings.medical_exam_enabled:
                sent_count += (
                    self.process_driver_dates(
                        organization=organization,
                        notification_type=(
                            "medical_exam"
                        ),
                        date_field=(
                            "medical_exam_expiry_date"
                        ),
                        event_name=(
                            "Badania lekarskie"
                        ),
                        preference_field=(
                            "medical_exam_enabled"
                        ),
                        notification_days=(
                            notification_days
                        ),
                        today=today,
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                (
                    "Zakończono. "
                    f"Wysłano wiadomości: {sent_count}"
                )
            )
        )

    def get_notification_days(
        self,
        settings,
    ):
        days = []

        if settings.notify_30_days:
            days.append(30)

        if settings.notify_14_days:
            days.append(14)

        if settings.notify_7_days:
            days.append(7)

        if settings.notify_1_day:
            days.append(1)

        return days

    def process_vehicle_dates(
        self,
        organization,
        notification_type,
        date_field,
        event_name,
        notification_days,
        today,
    ):
        sent_count = 0

        vehicles = (
            Vehicle.active_objects
            .filter(
                organization=organization,
            )
            .select_related(
                "company",
            )
        )

        for vehicle in vehicles:
            if (
                vehicle.company
                and not vehicle.company.is_active
            ):
                continue

            expiry_date = getattr(
                vehicle,
                date_field,
                None,
            )

            if not expiry_date:
                continue

            for days_before in notification_days:
                target_date = (
                    today
                    + timedelta(
                        days=days_before,
                    )
                )

                if expiry_date != target_date:
                    continue

                recipients = (
                    self.get_vehicle_recipients(
                        organization=organization,
                        vehicle=vehicle,
                        notification_type=(
                            notification_type
                        ),
                    )
                )

                for user in recipients:
                    if self.send_vehicle_notification(
                        organization=organization,
                        user=user,
                        vehicle=vehicle,
                        notification_type=(
                            notification_type
                        ),
                        event_name=event_name,
                        expiry_date=expiry_date,
                        days_before=days_before,
                        source_id=vehicle.id,
                    ):
                        sent_count += 1

        return sent_count

    def process_documents(
        self,
        organization,
        notification_days,
        today,
    ):
        sent_count = 0

        documents = (
            VehicleDocument.objects
            .filter(
                vehicle__organization=organization,
                vehicle__is_deleted=False,
                expiry_date__isnull=False,
            )
            .select_related(
                "vehicle",
                "vehicle__company",
            )
        )

        for document in documents:
            vehicle = document.vehicle

            if (
                vehicle.company
                and not vehicle.company.is_active
            ):
                continue

            expiry_date = document.expiry_date

            for days_before in notification_days:
                target_date = (
                    today
                    + timedelta(
                        days=days_before,
                    )
                )

                if expiry_date != target_date:
                    continue

                recipients = (
                    self.get_vehicle_recipients(
                        organization=organization,
                        vehicle=vehicle,
                        notification_type=(
                            "document"
                        ),
                    )
                )

                event_name = (
                    "Dokument pojazdu: "
                    f"{document.get_document_type_display()}"
                )

                for user in recipients:
                    if self.send_vehicle_notification(
                        organization=organization,
                        user=user,
                        vehicle=vehicle,
                        notification_type=(
                            "document"
                        ),
                        event_name=event_name,
                        expiry_date=expiry_date,
                        days_before=days_before,
                        source_id=document.id,
                    ):
                        sent_count += 1

        return sent_count

    def process_driver_dates(
        self,
        organization,
        notification_type,
        date_field,
        event_name,
        preference_field,
        notification_days,
        today,
    ):
        sent_count = 0

        drivers = (
            Driver.active_objects
            .filter(
                organization=organization,
            )
        )

        for driver in drivers:
            expiry_date = getattr(
                driver,
                date_field,
                None,
            )

            if not expiry_date:
                continue

            for days_before in notification_days:
                target_date = (
                    today
                    + timedelta(
                        days=days_before,
                    )
                )

                if expiry_date != target_date:
                    continue

                recipients = (
                    self.get_driver_recipients(
                        organization=organization,
                        preference_field=(
                            preference_field
                        ),
                    )
                )

                for user in recipients:
                    if self.send_driver_notification(
                        organization=organization,
                        user=user,
                        driver=driver,
                        notification_type=(
                            notification_type
                        ),
                        event_name=event_name,
                        expiry_date=expiry_date,
                        days_before=days_before,
                    ):
                        sent_count += 1

        return sent_count

    def get_vehicle_recipients(
        self,
        organization,
        vehicle,
        notification_type,
    ):
        recipients = []

        memberships = (
            OrganizationMembership.objects
            .filter(
                organization=organization,
                user__is_active=True,
            )
            .select_related(
                "user",
            )
        )

        preference_field = {
            "insurance": (
                "insurance_enabled"
            ),
            "inspection": (
                "inspection_enabled"
            ),
            "document": (
                "documents_enabled"
            ),
        }.get(
            notification_type
        )

        for membership in memberships:
            user = membership.user

            if not user.email:
                continue

            preference, _ = (
                NotificationPreference.objects
                .get_or_create(
                    user=user,
                )
            )

            if not preference.email_enabled:
                continue

            if (
                preference_field
                and not getattr(
                    preference,
                    preference_field,
                )
            ):
                continue

            if membership.role == "admin":
                recipients.append(
                    user
                )
                continue

            if not vehicle.company_id:
                continue

            if not vehicle.company.is_active:
                continue

            access = (
                CompanyAccess.objects
                .filter(
                    membership=membership,
                    company=vehicle.company,
                    company__organization=(
                        organization
                    ),
                    company__is_active=True,
                )
                .exists()
            )

            if access:
                recipients.append(
                    user
                )

        return recipients

    def get_driver_recipients(
        self,
        organization,
        preference_field,
    ):
        recipients = []

        memberships = (
            OrganizationMembership.objects
            .filter(
                organization=organization,
                role="admin",
                user__is_active=True,
            )
            .select_related(
                "user",
            )
        )

        for membership in memberships:
            user = membership.user

            if not user.email:
                continue

            preference, _ = (
                NotificationPreference.objects
                .get_or_create(
                    user=user,
                )
            )

            if not preference.email_enabled:
                continue

            if not getattr(
                preference,
                preference_field,
            ):
                continue

            recipients.append(
                user
            )

        return recipients

    def reserve_notification(
        self,
        organization,
        user,
        notification_type,
        source_id,
        expiry_date,
        days_before,
        recipient_email,
        subject,
        vehicle=None,
        driver=None,
    ):
        try:
            with transaction.atomic():
                notification_log, created = (
                    NotificationLog.objects
                    .get_or_create(
                        notification_type=(
                            notification_type
                        ),
                        user=user,
                        source_id=source_id,
                        expiry_date=expiry_date,
                        days_before=days_before,
                        defaults={
                            "organization": (
                                organization
                            ),
                            "vehicle": vehicle,
                            "driver": driver,
                            "recipient_email": (
                                recipient_email
                            ),
                            "subject": subject,
                        },
                    )
                )

            return (
                notification_log,
                created,
            )

        except IntegrityError:
            return (
                None,
                False,
            )

    def release_notification(
        self,
        notification_log,
    ):
        if notification_log is None:
            return

        try:
            notification_log.delete()
        except Exception:
            logger.exception(
                (
                    "Nie udało się usunąć rezerwacji "
                    "powiadomienia %s po błędzie wysyłki."
                ),
                notification_log.pk,
            )

    def send_vehicle_notification(
        self,
        organization,
        user,
        vehicle,
        notification_type,
        event_name,
        expiry_date,
        days_before,
        source_id,
    ):
        subject = (
            f"Flotivo - {event_name} "
            f"za {days_before} dni"
        )

        message = (
            f"Cześć {user.username},\n\n"
            "Flotivo przypomina o zbliżającym się "
            "terminie.\n\n"
            f"{event_name}\n"
            f"Pojazd: {vehicle.brand} {vehicle.model}\n"
            "Numer rejestracyjny: "
            f"{vehicle.registration_number}\n"
            f"Termin: {expiry_date.strftime('%d.%m.%Y')}\n"
            f"Pozostało: {days_before} dni\n\n"
            "Zaloguj się do Flotivo, aby sprawdzić "
            "szczegóły pojazdu.\n\n"
            "Flotivo"
        )

        notification_log, created = (
            self.reserve_notification(
                organization=organization,
                user=user,
                notification_type=(
                    notification_type
                ),
                source_id=source_id,
                expiry_date=expiry_date,
                days_before=days_before,
                recipient_email=user.email,
                subject=subject,
                vehicle=vehicle,
            )
        )

        if not created:
            return False

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

            self.stdout.write(
                self.style.SUCCESS(
                    (
                        f"Wysłano {notification_type}: "
                        f"{user.email} - "
                        f"{vehicle.registration_number}"
                    )
                )
            )

            return True

        except Exception:
            logger.exception(
                (
                    "Błąd wysyłki powiadomienia %s "
                    "do użytkownika %s."
                ),
                notification_type,
                user.id,
            )

            self.release_notification(
                notification_log
            )

            self.stderr.write(
                self.style.ERROR(
                    (
                        "Nie udało się wysłać "
                        "powiadomienia e-mail."
                    )
                )
            )

            return False

    def send_driver_notification(
        self,
        organization,
        user,
        driver,
        notification_type,
        event_name,
        expiry_date,
        days_before,
    ):
        driver_name = (
            f"{driver.first_name} "
            f"{driver.last_name}"
        )

        subject = (
            f"Flotivo - {event_name} kierowcy "
            f"za {days_before} dni"
        )

        message = (
            f"Cześć {user.username},\n\n"
            "Flotivo przypomina o zbliżającym się "
            "terminie dotyczącym kierowcy.\n\n"
            f"{event_name}\n"
            f"Kierowca: {driver_name}\n"
            f"Termin: {expiry_date.strftime('%d.%m.%Y')}\n"
            f"Pozostało: {days_before} dni\n\n"
            "Zaloguj się do Flotivo, aby sprawdzić "
            "profil kierowcy.\n\n"
            "Flotivo"
        )

        notification_log, created = (
            self.reserve_notification(
                organization=organization,
                user=user,
                notification_type=(
                    notification_type
                ),
                source_id=driver.id,
                expiry_date=expiry_date,
                days_before=days_before,
                recipient_email=user.email,
                subject=subject,
                driver=driver,
            )
        )

        if not created:
            return False

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

            self.stdout.write(
                self.style.SUCCESS(
                    (
                        f"Wysłano {notification_type}: "
                        f"{user.email} - "
                        f"{driver_name}"
                    )
                )
            )

            return True

        except Exception:
            logger.exception(
                (
                    "Błąd wysyłki powiadomienia %s "
                    "do użytkownika %s."
                ),
                notification_type,
                user.id,
            )

            self.release_notification(
                notification_log
            )

            self.stderr.write(
                self.style.ERROR(
                    (
                        "Nie udało się wysłać "
                        "powiadomienia e-mail."
                    )
                )
            )

            return False
