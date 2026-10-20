from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import OrganizationMembership, CompanyAccess, Company


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = (
            OrganizationMembership.objects
            .select_related("organization")
            .filter(user=request.user)
            .first()
        )

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
                is_active=True
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
                    company__is_active=True
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