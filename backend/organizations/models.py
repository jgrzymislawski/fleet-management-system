from django.core.exceptions import ValidationError
from django.db import models
from django.contrib.auth.models import User

from auditlog.registry import auditlog


class Organization(models.Model):
    name = models.CharField(
        max_length=200,
    )

    is_active = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    def __str__(self):
        return self.name


class Company(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="companies",
    )

    name = models.CharField(
        max_length=200,
    )

    tax_id = models.CharField(
        max_length=30,
        blank=True,
    )

    is_active = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    def clean(self):
        self.name = (
            self.name.strip()
            if self.name
            else self.name
        )

        self.tax_id = (
            self.tax_id.strip()
            if self.tax_id
            else ""
        )

        if not self.name:
            raise ValidationError(
                {
                    "name": (
                        "Nazwa spółki jest wymagana."
                    )
                }
            )

    def save(
        self,
        *args,
        **kwargs,
    ):
        self.full_clean()

        super().save(
            *args,
            **kwargs,
        )

    class Meta:
        verbose_name_plural = (
            "Companies"
        )

    def __str__(self):
        return self.name


class OrganizationMembership(models.Model):
    ROLE_CHOICES = [
        (
            "admin",
            "Administrator",
        ),
        (
            "member",
            "Użytkownik",
        ),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name=(
            "organization_membership"
        ),
    )

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="memberships",
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="member",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    def clean(self):
        if not self.organization_id:
            raise ValidationError(
                {
                    "organization": (
                        "Użytkownik musi należeć "
                        "do organizacji."
                    )
                }
            )

    def save(
        self,
        *args,
        **kwargs,
    ):
        self.full_clean()

        super().save(
            *args,
            **kwargs,
        )

    def __str__(self):
        return (
            f"{self.user.username} - "
            f"{self.organization.name}"
        )


class CompanyAccess(models.Model):
    ROLE_CHOICES = [
        (
            "viewer",
            "Tylko odczyt",
        ),
        (
            "editor",
            "Odczyt i edycja",
        ),
    ]

    membership = models.ForeignKey(
        OrganizationMembership,
        on_delete=models.CASCADE,
        related_name=(
            "company_accesses"
        ),
    )

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name=(
            "user_accesses"
        ),
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="viewer",
    )

    def clean(self):
        if (
            self.membership_id
            and self.company_id
            and (
                self.membership.organization_id
                != self.company.organization_id
            )
        ):
            raise ValidationError(
                {
                    "company": (
                        "Użytkownik i spółka muszą "
                        "należeć do tej samej "
                        "organizacji."
                    )
                }
            )

    def save(
        self,
        *args,
        **kwargs,
    ):
        self.full_clean()

        super().save(
            *args,
            **kwargs,
        )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "membership",
                    "company",
                ],
                name=(
                    "unique_membership_"
                    "company_access"
                ),
            )
        ]

    def __str__(self):
        return (
            f"{self.membership.user.username} - "
            f"{self.company.name} - "
            f"{self.role}"
        )


auditlog.register(
    Organization
)

auditlog.register(
    Company
)

auditlog.register(
    OrganizationMembership
)

auditlog.register(
    CompanyAccess
)

auditlog.register(
    User,
    exclude_fields=[
        "password",
        "last_login",
    ],
)