from django.contrib.auth import update_session_auth_hash

from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from auditlog.context import set_actor

from .models import (
    OrganizationMembership,
    CompanyAccess,
    Company,
)

from .serializers import (
    CompanySerializer,
    AdminUserSerializer,
    AdminUserCreateSerializer,
    AdminUserUpdateSerializer,
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


def get_admin_membership(user):
    membership = get_membership(user)

    if membership is None:
        raise PermissionDenied(
            "Użytkownik nie jest przypisany do żadnej organizacji."
        )

    if membership.role != "admin":
        raise PermissionDenied(
            "Tylko administrator organizacji ma dostęp do tej funkcji."
        )

    return membership


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = get_membership(request.user)

        if membership is None:
            return Response({
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
                "organization": None,
                "role": None,
                "companies": [],
            })

        if membership.role == "admin":
            companies = Company.objects.filter(
                organization=membership.organization,
                is_active=True,
            )

            company_data = [
                {
                    "id": company.id,
                    "name": company.name,
                    "role": "admin",
                }
                for company in companies
            ]
        else:
            accesses = (
                CompanyAccess.objects
                .select_related("company")
                .filter(
                    membership=membership,
                    company__is_active=True,
                )
            )

            company_data = [
                {
                    "id": access.company.id,
                    "name": access.company.name,
                    "role": access.role,
                }
                for access in accesses
            ]

        return Response({
            "id": request.user.id,
            "username": request.user.username,
            "email": request.user.email,
            "organization": {
                "id": membership.organization.id,
                "name": membership.organization.name,
            },
            "role": membership.role,
            "companies": company_data,
        })


class CompanyListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if user_is_superuser(request.user):
            companies = Company.objects.filter(
                is_active=True,
            ).order_by("name")

        else:
            membership = get_membership(request.user)

            if membership is None:
                return Response([])

            if membership.role == "admin":
                companies = Company.objects.filter(
                    organization=membership.organization,
                    is_active=True,
                ).order_by("name")

            else:
                company_ids = CompanyAccess.objects.filter(
                    membership=membership,
                    company__is_active=True,
                ).values_list(
                    "company_id",
                    flat=True,
                )

                companies = Company.objects.filter(
                    id__in=company_ids,
                    organization=membership.organization,
                    is_active=True,
                ).order_by("name")

        serializer = CompanySerializer(
            companies,
            many=True,
        )

        return Response(serializer.data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        current_password = request.data.get(
            "current_password"
        )

        new_password = request.data.get(
            "new_password"
        )

        confirm_password = request.data.get(
            "confirm_password"
        )

        if not current_password:
            return Response(
                {
                    "current_password": [
                        "Podaj aktualne hasło."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not new_password:
            return Response(
                {
                    "new_password": [
                        "Podaj nowe hasło."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not confirm_password:
            return Response(
                {
                    "confirm_password": [
                        "Powtórz nowe hasło."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.check_password(
            current_password
        ):
            return Response(
                {
                    "current_password": [
                        "Aktualne hasło jest nieprawidłowe."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_password != confirm_password:
            return Response(
                {
                    "confirm_password": [
                        "Hasła nie są takie same."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if current_password == new_password:
            return Response(
                {
                    "new_password": [
                        "Nowe hasło musi być inne niż aktualne."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)

        with set_actor(request.user):
            user.save()

        update_session_auth_hash(
            request,
            user,
        )

        return Response(
            {
                "detail": "Hasło zostało zmienione."
            },
            status=status.HTTP_200_OK,
        )


class AdminCompanyListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = get_admin_membership(
            request.user
        )

        companies = Company.objects.filter(
            organization=membership.organization,
        ).order_by(
            "name"
        )

        serializer = CompanySerializer(
            companies,
            many=True,
        )

        return Response(serializer.data)

    def post(self, request):
        membership = get_admin_membership(
            request.user
        )

        serializer = CompanySerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        with set_actor(request.user):
            serializer.save(
                organization=membership.organization
            )

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )


class AdminCompanyDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_company(self, membership, company_id):
        company = Company.objects.filter(
            id=company_id,
            organization=membership.organization,
        ).first()

        if company is None:
            raise NotFound(
                "Nie znaleziono spółki."
            )

        return company

    def get(self, request, company_id):
        membership = get_admin_membership(
            request.user
        )

        company = self.get_company(
            membership,
            company_id,
        )

        serializer = CompanySerializer(
            company
        )

        return Response(serializer.data)

    def put(self, request, company_id):
        membership = get_admin_membership(
            request.user
        )

        company = self.get_company(
            membership,
            company_id,
        )

        serializer = CompanySerializer(
            company,
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True
        )

        with set_actor(request.user):
            serializer.save()

        return Response(serializer.data)

    def patch(self, request, company_id):
        membership = get_admin_membership(
            request.user
        )

        company = self.get_company(
            membership,
            company_id,
        )

        serializer = CompanySerializer(
            company,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True
        )

        with set_actor(request.user):
            serializer.save()

        return Response(serializer.data)


class AdminUserListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = get_admin_membership(
            request.user
        )

        memberships = (
            OrganizationMembership.objects
            .select_related(
                "user",
                "organization",
            )
            .filter(
                organization=membership.organization,
            )
            .order_by(
                "user__username",
            )
        )

        serializer = AdminUserSerializer(
            memberships,
            many=True,
        )

        return Response(serializer.data)

    def post(self, request):
        membership = get_admin_membership(
            request.user
        )

        serializer = AdminUserCreateSerializer(
            data=request.data,
            context={
                "organization": membership.organization,
            },
        )

        serializer.is_valid(
            raise_exception=True
        )

        with set_actor(request.user):
            created_membership = serializer.save()

        response_serializer = AdminUserSerializer(
            created_membership
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )


class AdminUserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_user_membership(
        self,
        admin_membership,
        membership_id,
    ):
        membership = (
            OrganizationMembership.objects
            .select_related(
                "user",
                "organization",
            )
            .filter(
                id=membership_id,
                organization=admin_membership.organization,
            )
            .first()
        )

        if membership is None:
            raise NotFound(
                "Nie znaleziono użytkownika."
            )

        return membership

    def get(self, request, membership_id):
        admin_membership = get_admin_membership(
            request.user
        )

        membership = self.get_user_membership(
            admin_membership,
            membership_id,
        )

        serializer = AdminUserSerializer(
            membership
        )

        return Response(serializer.data)

    def put(self, request, membership_id):
        admin_membership = get_admin_membership(
            request.user
        )

        membership = self.get_user_membership(
            admin_membership,
            membership_id,
        )

        self.validate_self_update(
            request,
            membership,
        )

        serializer = AdminUserUpdateSerializer(
            membership,
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True
        )

        with set_actor(request.user):
            updated_membership = serializer.save()

        response_serializer = AdminUserSerializer(
            updated_membership
        )

        return Response(
            response_serializer.data
        )

    def patch(self, request, membership_id):
        admin_membership = get_admin_membership(
            request.user
        )

        membership = self.get_user_membership(
            admin_membership,
            membership_id,
        )

        self.validate_self_update(
            request,
            membership,
        )

        serializer = AdminUserUpdateSerializer(
            membership,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True
        )

        with set_actor(request.user):
            updated_membership = serializer.save()

        response_serializer = AdminUserSerializer(
            updated_membership
        )

        return Response(
            response_serializer.data
        )

    def validate_self_update(
        self,
        request,
        membership,
    ):
        if membership.user_id != request.user.id:
            return

        new_is_active = request.data.get(
            "is_active"
        )

        new_role = request.data.get(
            "role"
        )

        if new_is_active is False:
            raise PermissionDenied(
                "Nie możesz dezaktywować własnego konta."
            )

        if new_role and new_role != "admin":
            raise PermissionDenied(
                "Nie możesz odebrać sobie roli administratora."
            )