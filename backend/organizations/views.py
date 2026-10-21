from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import (
    OrganizationMembership,
    CompanyAccess,
    Company,
)
from .serializers import CompanySerializer


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
                is_active=True
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