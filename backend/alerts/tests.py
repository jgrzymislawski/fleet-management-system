from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from organizations.models import (
    Company,
    CompanyAccess,
    Organization,
    OrganizationMembership,
)
from vehicles.models import Vehicle
from drivers.models import Driver


class AlertsSecurityTests(
    APITestCase
):
    def setUp(self):
        today = timezone.localdate()

        self.organization_a = (
            Organization.objects.create(
                name="Organizacja A"
            )
        )

        self.organization_b = (
            Organization.objects.create(
                name="Organizacja B"
            )
        )

        self.company_a = (
            Company.objects.create(
                organization=(
                    self.organization_a
                ),
                name="Spółka A",
                tax_id="1111111111",
            )
        )

        self.company_b = (
            Company.objects.create(
                organization=(
                    self.organization_b
                ),
                name="Spółka B",
                tax_id="2222222222",
            )
        )

        self.admin_a = (
            User.objects.create_user(
                username="admin_a",
                password="TestPassword123!",
            )
        )

        self.member_a = (
            User.objects.create_user(
                username="member_a",
                password="TestPassword123!",
            )
        )

        self.admin_membership_a = (
            OrganizationMembership.objects.create(
                user=self.admin_a,
                organization=(
                    self.organization_a
                ),
                role="admin",
            )
        )

        self.member_membership_a = (
            OrganizationMembership.objects.create(
                user=self.member_a,
                organization=(
                    self.organization_a
                ),
                role="member",
            )
        )

        CompanyAccess.objects.create(
            membership=(
                self.member_membership_a
            ),
            company=self.company_a,
            role="viewer",
        )

        self.vehicle_a = (
            Vehicle.objects.create(
                organization=(
                    self.organization_a
                ),
                company=self.company_a,
                brand="Ford",
                model="Focus",
                registration_number="DL11111",
                vin="WF0AAA11111111111",
                year=2020,
                insurance_expiry_date=(
                    today
                    + timedelta(
                        days=7,
                    )
                ),
            )
        )

        self.vehicle_b = (
            Vehicle.objects.create(
                organization=(
                    self.organization_b
                ),
                company=self.company_b,
                brand="Toyota",
                model="Corolla",
                registration_number="DW22222",
                vin="JTDBBB22222222222",
                year=2021,
                insurance_expiry_date=(
                    today
                    + timedelta(
                        days=7,
                    )
                ),
            )
        )

        self.driver_a = (
            Driver.objects.create(
                organization=(
                    self.organization_a
                ),
                first_name="Jan",
                last_name="Kowalski",
                license_number="A111",
                license_categories=[
                    "B",
                ],
                phone_number="500600700",
                hired_at=today,
                license_expiry_date=(
                    today
                    + timedelta(
                        days=7,
                    )
                ),
            )
        )

        self.driver_b = (
            Driver.objects.create(
                organization=(
                    self.organization_b
                ),
                first_name="Adam",
                last_name="Nowak",
                license_number="B222",
                license_categories=[
                    "B",
                ],
                phone_number="500600701",
                hired_at=today,
                license_expiry_date=(
                    today
                    + timedelta(
                        days=7,
                    )
                ),
            )
        )

    def authenticate(
        self,
        user,
    ):
        self.client.force_authenticate(
            user=user
        )

    def test_admin_sees_only_own_organization_alerts(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            "/api/alerts/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        target_ids = {
            (
                item["category"],
                item["targetId"],
            )
            for item
            in response.data["results"]
        }

        self.assertIn(
            (
                "vehicle",
                self.vehicle_a.id,
            ),
            target_ids,
        )

        self.assertIn(
            (
                "driver",
                self.driver_a.id,
            ),
            target_ids,
        )

        self.assertNotIn(
            (
                "vehicle",
                self.vehicle_b.id,
            ),
            target_ids,
        )

        self.assertNotIn(
            (
                "driver",
                self.driver_b.id,
            ),
            target_ids,
        )

    def test_member_sees_vehicle_but_not_driver_alerts(
        self,
    ):
        self.authenticate(
            self.member_a
        )

        response = self.client.get(
            "/api/alerts/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        categories = {
            item["category"]
            for item
            in response.data["results"]
        }

        self.assertIn(
            "vehicle",
            categories,
        )

        self.assertNotIn(
            "driver",
            categories,
        )

    def test_inactive_organization_is_blocked(
        self,
    ):
        self.organization_a.is_active = False
        self.organization_a.save(
            update_fields=[
                "is_active",
            ]
        )

        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            "/api/alerts/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_invalid_category_returns_400(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            "/api/alerts/?category=test"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_invalid_page_returns_400(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            "/api/alerts/?page=abc"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_invalid_page_size_returns_400(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            "/api/alerts/?page_size=1000"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
