from django.db import models
from django.contrib.auth.models import User
from auditlog.registry import auditlog

class Organization(models.Model):
    name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Company(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="companies"
    )

    name = models.CharField(max_length=200)

    tax_id = models.CharField(
        max_length=30,
        blank=True
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Companies"

    def __str__(self):
        return self.name

class OrganizationMembership(models.Model):
    ROLE_CHOICES = [
        ("admin", "Administrator"),
        ("member", "Użytkownik"),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="organization_membership"
    )

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="memberships"
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="member"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.organization.name}"

class CompanyAccess(models.Model):
    ROLE_CHOICES = [
        ("viewer", "Tylko odczyt"),
        ("editor", "Odczyt i edycja"),
    ]

    membership = models.ForeignKey(
        OrganizationMembership,
        on_delete=models.CASCADE,
        related_name="company_accesses"
    )

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="user_accesses"
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="viewer"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["membership", "company"],
                name="unique_membership_company_access"
            )
        ]

    def __str__(self):
        return (
            f"{self.membership.user.username} - "
            f"{self.company.name} - {self.role}"
        )

auditlog.register(Organization)
auditlog.register(Company)
auditlog.register(OrganizationMembership)
auditlog.register(CompanyAccess)
auditlog.register(
    User,
    exclude_fields=[
        "password",
        "last_login",
    ],
)