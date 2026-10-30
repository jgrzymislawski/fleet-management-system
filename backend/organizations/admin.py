from django import forms
from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction

from .models import (
    Organization,
    Company,
    OrganizationMembership,
    CompanyAccess,
)


class OrganizationAdminForm(forms.ModelForm):
    company_name = forms.CharField(
        label="Nazwa pierwszej spółki",
        max_length=200,
        required=False,
    )

    tax_id = forms.CharField(
        label="NIP",
        max_length=30,
        required=False,
    )

    admin_username = forms.CharField(
        label="Login administratora",
        max_length=150,
        required=False,
    )

    admin_email = forms.EmailField(
        label="E-mail administratora",
        required=False,
    )

    password1 = forms.CharField(
        label="Hasło",
        widget=forms.PasswordInput,
        required=False,
    )

    password2 = forms.CharField(
        label="Powtórz hasło",
        widget=forms.PasswordInput,
        required=False,
    )

    class Meta:
        model = Organization
        fields = [
            "name",
            "is_active",
        ]

    def clean_admin_username(self):
        username = self.cleaned_data.get("admin_username")

        if self.instance and self.instance.pk:
            return username

        if username and User.objects.filter(
            username=username
        ).exists():
            raise forms.ValidationError(
                "Użytkownik z takim loginem już istnieje."
            )

        return username

    def clean_admin_email(self):
        email = self.cleaned_data.get("admin_email")

        if self.instance and self.instance.pk:
            return email

        if email and User.objects.filter(
            email__iexact=email
        ).exists():
            raise forms.ValidationError(
                "Użytkownik z takim adresem e-mail już istnieje."
            )

        return email

    def clean(self):
        cleaned_data = super().clean()

        if self.instance and self.instance.pk:
            return cleaned_data

        company_name = cleaned_data.get("company_name")
        admin_username = cleaned_data.get("admin_username")
        admin_email = cleaned_data.get("admin_email")
        password1 = cleaned_data.get("password1")
        password2 = cleaned_data.get("password2")

        if not company_name:
            self.add_error(
                "company_name",
                "Podaj nazwę pierwszej spółki.",
            )

        if not admin_username:
            self.add_error(
                "admin_username",
                "Podaj login administratora.",
            )

        if not admin_email:
            self.add_error(
                "admin_email",
                "Podaj adres e-mail administratora.",
            )

        if not password1:
            self.add_error(
                "password1",
                "Podaj hasło administratora.",
            )

        if not password2:
            self.add_error(
                "password2",
                "Powtórz hasło administratora.",
            )

        if password1 and password2:
            if password1 != password2:
                self.add_error(
                    "password2",
                    "Podane hasła nie są takie same.",
                )
            else:
                try:
                    validate_password(password1)
                except ValidationError as error:
                    self.add_error(
                        "password1",
                        error,
                    )

        return cleaned_data


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    form = OrganizationAdminForm

    list_display = [
        "name",
        "is_active",
        "created_at",
    ]

    list_filter = [
        "is_active",
    ]

    search_fields = [
        "name",
    ]

    readonly_fields = [
        "created_at",
    ]

    def get_fieldsets(self, request, obj=None):
        if obj is None:
            return [
                (
                    "Organizacja",
                    {
                        "fields": [
                            "name",
                            "is_active",
                        ]
                    },
                ),
                (
                    "Pierwsza spółka",
                    {
                        "fields": [
                            "company_name",
                            "tax_id",
                        ]
                    },
                ),
                (
                    "Administrator klienta",
                    {
                        "fields": [
                            "admin_username",
                            "admin_email",
                            "password1",
                            "password2",
                        ]
                    },
                ),
            ]

        return [
            (
                "Organizacja",
                {
                    "fields": [
                        "name",
                        "is_active",
                        "created_at",
                    ]
                },
            ),
        ]

    def save_model(
        self,
        request,
        obj,
        form,
        change,
    ):
        if change:
            super().save_model(
                request,
                obj,
                form,
                change,
            )
            return

        with transaction.atomic():
            super().save_model(
                request,
                obj,
                form,
                change,
            )

            Company.objects.create(
                organization=obj,
                name=form.cleaned_data["company_name"],
                tax_id=form.cleaned_data.get("tax_id", ""),
                is_active=True,
            )

            user = User.objects.create_user(
                username=form.cleaned_data["admin_username"],
                email=form.cleaned_data["admin_email"],
                password=form.cleaned_data["password1"],
                is_active=True,
            )

            OrganizationMembership.objects.create(
                user=user,
                organization=obj,
                role="admin",
            )


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "organization",
        "tax_id",
        "is_active",
        "created_at",
    ]

    list_filter = [
        "is_active",
        "organization",
    ]

    search_fields = [
        "name",
        "tax_id",
        "organization__name",
    ]


@admin.register(OrganizationMembership)
class OrganizationMembershipAdmin(admin.ModelAdmin):
    list_display = [
        "user",
        "organization",
        "role",
        "created_at",
    ]

    list_filter = [
        "role",
        "organization",
    ]

    search_fields = [
        "user__username",
        "user__email",
        "organization__name",
    ]


@admin.register(CompanyAccess)
class CompanyAccessAdmin(admin.ModelAdmin):
    list_display = [
        "membership",
        "company",
        "role",
    ]

    list_filter = [
        "role",
        "company",
    ]

    search_fields = [
        "membership__user__username",
        "membership__user__email",
        "company__name",
        "membership__organization__name",
    ]