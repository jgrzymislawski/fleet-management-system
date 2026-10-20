from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from organizations.models import OrganizationMembership, CompanyAccess
from .models import Vehicle, ServiceRecord, VehicleDocument
from .serializers import (
    VehicleSerializer,
    ServiceRecordSerializer,
    VehicleDocumentSerializer,
)


def user_is_superuser(user):
    return bool(getattr(user, "is_superuser", False))


def get_membership(user):
    if not getattr(user, "is_authenticated", False):
        return None

    return (
        OrganizationMembership.objects
        .select_related("organization")
        .filter(user=user)
        .first()
    )


def get_accessible_vehicles(user):
    if user_is_superuser(user):
        return Vehicle.objects.all()

    membership = get_membership(user)

    if membership is None:
        return Vehicle.objects.none()

    if membership.role == "admin":
        return Vehicle.objects.filter(
            organization=membership.organization
        )

    company_ids = CompanyAccess.objects.filter(
        membership=membership
    ).values_list(
        "company_id",
        flat=True
    )

    return Vehicle.objects.filter(
        organization=membership.organization,
        company_id__in=company_ids
    )


def can_edit_company(membership, company):
    if membership is None:
        return False

    if membership.role == "admin":
        if company is None:
            return True

        return company.organization_id == membership.organization_id

    if company is None:
        return False

    return CompanyAccess.objects.filter(
        membership=membership,
        company=company,
        role="editor"
    ).exists()


def ensure_vehicle_edit_permission(user, vehicle):
    if user_is_superuser(user):
        return

    membership = get_membership(user)

    if membership is None:
        raise PermissionDenied(
            "Nie masz dostępu do tej organizacji."
        )

    if vehicle.organization_id != membership.organization_id:
        raise PermissionDenied(
            "Nie masz dostępu do tego pojazdu."
        )

    if membership.role == "admin":
        return

    if not can_edit_company(membership, vehicle.company):
        raise PermissionDenied(
            "Masz tylko uprawnienia do odczytu."
        )


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer

    def get_queryset(self):
        return get_accessible_vehicles(self.request.user)

    def perform_create(self, serializer):
        user = self.request.user

        if user_is_superuser(user):
            serializer.save()
            return

        membership = get_membership(user)

        if membership is None:
            raise PermissionDenied(
                "Nie jesteś przypisany do żadnej organizacji."
            )

        company = serializer.validated_data.get("company")

        if (
            company is not None
            and company.organization_id != membership.organization_id
        ):
            raise PermissionDenied(
                "Ta spółka należy do innej organizacji."
            )

        if not can_edit_company(membership, company):
            raise PermissionDenied(
                "Nie masz uprawnień do dodawania pojazdów w tej spółce."
            )

        serializer.save(
            organization=membership.organization
        )

    def perform_update(self, serializer):
        vehicle = self.get_object()

        ensure_vehicle_edit_permission(
            self.request.user,
            vehicle
        )

        if user_is_superuser(self.request.user):
            serializer.save()
            return

        membership = get_membership(self.request.user)

        if membership is None:
            raise PermissionDenied(
                "Nie jesteś przypisany do żadnej organizacji."
            )

        company = serializer.validated_data.get(
            "company",
            vehicle.company
        )

        if (
            company is not None
            and company.organization_id != membership.organization_id
        ):
            raise PermissionDenied(
                "Ta spółka należy do innej organizacji."
            )

        if not can_edit_company(membership, company):
            raise PermissionDenied(
                "Nie masz uprawnień do tej spółki."
            )

        serializer.save(
            organization=membership.organization
        )

    def perform_destroy(self, instance):
        ensure_vehicle_edit_permission(
            self.request.user,
            instance
        )

        instance.delete()


class ServiceRecordViewSet(viewsets.ModelViewSet):
    queryset = ServiceRecord.objects.all()
    serializer_class = ServiceRecordSerializer

    def get_queryset(self):
        accessible_vehicles = get_accessible_vehicles(
            self.request.user
        )

        queryset = ServiceRecord.objects.filter(
            vehicle__in=accessible_vehicles
        )

        vehicle_id = self.request.query_params.get("vehicle")

        if vehicle_id:
            queryset = queryset.filter(
                vehicle_id=vehicle_id
            )

        return queryset

    def perform_create(self, serializer):
        vehicle = serializer.validated_data.get("vehicle")

        if vehicle is None:
            raise PermissionDenied(
                "Nie wybrano pojazdu."
            )

        ensure_vehicle_edit_permission(
            self.request.user,
            vehicle
        )

        serializer.save()

    def perform_update(self, serializer):
        record = self.get_object()

        ensure_vehicle_edit_permission(
            self.request.user,
            record.vehicle
        )

        vehicle = serializer.validated_data.get(
            "vehicle",
            record.vehicle
        )

        ensure_vehicle_edit_permission(
            self.request.user,
            vehicle
        )

        serializer.save()

    def perform_destroy(self, instance):
        ensure_vehicle_edit_permission(
            self.request.user,
            instance.vehicle
        )

        instance.delete()


class VehicleDocumentViewSet(viewsets.ModelViewSet):
    queryset = VehicleDocument.objects.all()
    serializer_class = VehicleDocumentSerializer

    def get_queryset(self):
        accessible_vehicles = get_accessible_vehicles(
            self.request.user
        )

        queryset = VehicleDocument.objects.filter(
            vehicle__in=accessible_vehicles
        )

        vehicle_id = self.request.query_params.get("vehicle")

        if vehicle_id:
            queryset = queryset.filter(
                vehicle_id=vehicle_id
            )

        return queryset

    def perform_create(self, serializer):
        vehicle = serializer.validated_data.get("vehicle")

        if vehicle is None:
            raise PermissionDenied(
                "Nie wybrano pojazdu."
            )

        ensure_vehicle_edit_permission(
            self.request.user,
            vehicle
        )

        serializer.save()

    def perform_update(self, serializer):
        document = self.get_object()

        ensure_vehicle_edit_permission(
            self.request.user,
            document.vehicle
        )

        vehicle = serializer.validated_data.get(
            "vehicle",
            document.vehicle
        )

        ensure_vehicle_edit_permission(
            self.request.user,
            vehicle
        )

        serializer.save()

    def perform_destroy(self, instance):
        ensure_vehicle_edit_permission(
            self.request.user,
            instance.vehicle
        )

        instance.delete()