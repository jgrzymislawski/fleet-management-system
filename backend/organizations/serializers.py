from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.db import transaction

from rest_framework import serializers

from .models import (
    Company,
    CompanyAccess,
    OrganizationMembership,
)


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "tax_id",
            "is_active",
        ]
        read_only_fields = [
            "id",
        ]


class AdminUserSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source="user.username",
        read_only=True,
    )
    email = serializers.EmailField(
        source="user.email",
        read_only=True,
    )
    is_active = serializers.BooleanField(
        source="user.is_active",
        read_only=True,
    )
    companies = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationMembership
        fields = [
            "id",
            "username",
            "email",
            "is_active",
            "role",
            "companies",
        ]

    def get_companies(self, membership):
        if membership.role == "admin":
            companies = Company.objects.filter(
                organization=membership.organization,
                is_active=True,
            ).order_by("name")

            return [
                {
                    "id": company.id,
                    "name": company.name,
                    "role": "admin",
                }
                for company in companies
            ]

        accesses = (
            CompanyAccess.objects
            .select_related("company")
            .filter(
                membership=membership,
                company__is_active=True,
            )
            .order_by("company__name")
        )

        return [
            {
                "id": access.company.id,
                "name": access.company.name,
                "role": access.role,
            }
            for access in accesses
        ]


class AdminUserCreateSerializer(serializers.Serializer):
    username = serializers.CharField(
        max_length=150,
    )
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
    )
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )
    confirm_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )
    role = serializers.ChoiceField(
        choices=OrganizationMembership.ROLE_CHOICES,
        default="member",
    )
    companies = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
        write_only=True,
    )

    def validate_username(self, value):
        username = value.strip()

        if User.objects.filter(
            username__iexact=username,
        ).exists():
            raise serializers.ValidationError(
                "Użytkownik o takiej nazwie już istnieje."
            )

        return username

    def validate(self, attrs):
        password = attrs.get("password")
        confirm_password = attrs.get(
            "confirm_password"
        )
        role = attrs.get("role")
        companies = attrs.get("companies", [])

        if password != confirm_password:
            raise serializers.ValidationError(
                {
                    "confirm_password": (
                        "Hasła nie są takie same."
                    )
                }
            )

        validate_password(password)

        organization = self.context.get(
            "organization"
        )

        if organization is None:
            raise serializers.ValidationError(
                "Nie udało się ustalić organizacji."
            )

        if role == "admin":
            attrs["companies"] = []
            return attrs

        company_ids = set()

        for access in companies:
            company_id = access.get(
                "company_id"
            )
            company_role = access.get(
                "role"
            )

            if not company_id:
                raise serializers.ValidationError(
                    {
                        "companies": (
                            "Brakuje identyfikatora spółki."
                        )
                    }
                )

            if company_role not in [
                "viewer",
                "editor",
            ]:
                raise serializers.ValidationError(
                    {
                        "companies": (
                            "Nieprawidłowy poziom "
                            "dostępu do spółki."
                        )
                    }
                )

            if company_id in company_ids:
                raise serializers.ValidationError(
                    {
                        "companies": (
                            "Ta sama spółka została "
                            "przypisana więcej niż raz."
                        )
                    }
                )

            company_ids.add(company_id)

            company = Company.objects.filter(
                id=company_id,
                organization=organization,
                is_active=True,
            ).first()

            if company is None:
                raise serializers.ValidationError(
                    {
                        "companies": (
                            "Wybrana spółka nie istnieje "
                            "lub nie należy do tej organizacji."
                        )
                    }
                )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        organization = self.context[
            "organization"
        ]

        companies = validated_data.pop(
            "companies",
            [],
        )

        password = validated_data.pop(
            "password"
        )

        validated_data.pop(
            "confirm_password"
        )

        role = validated_data.pop(
            "role"
        )

        user = User.objects.create_user(
            username=validated_data[
                "username"
            ],
            email=validated_data.get(
                "email",
                "",
            ),
            password=password,
        )

        membership = (
            OrganizationMembership.objects.create(
                user=user,
                organization=organization,
                role=role,
            )
        )

        if role == "member":
            for access in companies:
                company = Company.objects.get(
                    id=access["company_id"],
                    organization=organization,
                )

                CompanyAccess.objects.create(
                    membership=membership,
                    company=company,
                    role=access["role"],
                )

        return membership


class AdminUserUpdateSerializer(serializers.Serializer):
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
    )
    is_active = serializers.BooleanField()
    role = serializers.ChoiceField(
        choices=OrganizationMembership.ROLE_CHOICES,
    )
    companies = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
        write_only=True,
    )

    def validate(self, attrs):
        membership = self.instance

        if membership is None:
            raise serializers.ValidationError(
                "Nie udało się ustalić użytkownika."
            )

        role = attrs.get(
            "role",
            membership.role,
        )

        companies = attrs.get(
            "companies",
            [],
        )

        if role == "admin":
            attrs["companies"] = []
            return attrs

        organization = membership.organization
        company_ids = set()

        for access in companies:
            company_id = access.get(
                "company_id"
            )

            company_role = access.get(
                "role"
            )

            if not company_id:
                raise serializers.ValidationError(
                    {
                        "companies": (
                            "Brakuje identyfikatora spółki."
                        )
                    }
                )

            if company_role not in [
                "viewer",
                "editor",
            ]:
                raise serializers.ValidationError(
                    {
                        "companies": (
                            "Nieprawidłowy poziom "
                            "dostępu do spółki."
                        )
                    }
                )

            if company_id in company_ids:
                raise serializers.ValidationError(
                    {
                        "companies": (
                            "Ta sama spółka została "
                            "przypisana więcej niż raz."
                        )
                    }
                )

            company_ids.add(company_id)

            company = Company.objects.filter(
                id=company_id,
                organization=organization,
                is_active=True,
            ).first()

            if company is None:
                raise serializers.ValidationError(
                    {
                        "companies": (
                            "Wybrana spółka nie istnieje "
                            "lub nie należy do tej organizacji."
                        )
                    }
                )

        return attrs

    @transaction.atomic
    def update(self, membership, validated_data):
        companies = validated_data.pop(
            "companies",
            [],
        )

        email = validated_data.pop(
            "email",
            membership.user.email,
        )

        is_active = validated_data.pop(
            "is_active",
            membership.user.is_active,
        )

        role = validated_data.pop(
            "role",
            membership.role,
        )

        user = membership.user

        user.email = email
        user.is_active = is_active
        user.save(
            update_fields=[
                "email",
                "is_active",
            ]
        )

        membership.role = role
        membership.save(
            update_fields=[
                "role",
            ]
        )

        CompanyAccess.objects.filter(
            membership=membership,
        ).delete()

        if role == "member":
            for access in companies:
                company = Company.objects.get(
                    id=access["company_id"],
                    organization=membership.organization,
                    is_active=True,
                )

                CompanyAccess.objects.create(
                    membership=membership,
                    company=company,
                    role=access["role"],
                )

        return membership