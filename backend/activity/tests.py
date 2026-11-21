from django.contrib.auth.models import User

from auditlog.context import set_actor
from auditlog.models import LogEntry

from rest_framework import status
from rest_framework.test import APITestCase

from organizations.models import (
    Company,
    Organization,
    OrganizationMembership,
)
from vehicles.models import Vehicle


class ActivitySecurityTests(
    APITestCase
):
    def setUp(self):
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

        self.admin_b = (
            User.objects.create_user(
                username="admin_b",
                password="TestPassword123!",
            )
        )

        self.member_a = (
            User.objects.create_user(
                username="member_a",
                password="TestPassword123!",
            )
        )

        OrganizationMembership.objects.create(
            user=self.admin_a,
            organization=(
                self.organization_a
            ),
            role="admin",
        )

        OrganizationMembership.objects.create(
            user=self.admin_b,
            organization=(
                self.organization_b
            ),
            role="admin",
        )

        OrganizationMembership.objects.create(
            user=self.member_a,
            organization=(
                self.organization_a
            ),
            role="member",
        )

        with set_actor(
            self.admin_a
        ):
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
                )
            )

        with set_actor(
            self.admin_b
        ):
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
                )
            )

    def authenticate(
        self,
        user,
    ):
        self.client.force_authenticate(
            user=user
        )

    def test_admin_sees_only_own_organization_logs(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            "/api/activity/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        object_reprs = {
            item["object_repr"]
            for item
            in response.data["logs"]
        }

        self.assertIn(
            str(
                self.vehicle_a
            ),
            object_reprs,
        )

        self.assertNotIn(
            str(
                self.vehicle_b
            ),
            object_reprs,
        )

    def test_member_cannot_access_activity(
        self,
    ):
        self.authenticate(
            self.member_a
        )

        response = self.client.get(
            "/api/activity/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
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
            "/api/activity/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_invalid_page_returns_400(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            "/api/activity/?page=abc"
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
            "/api/activity/?page_size=1000"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_invalid_action_returns_400(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            "/api/activity/?action=test"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_invalid_user_filter_returns_400(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            "/api/activity/?user=abc"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_long_search_returns_400(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            (
                "/api/activity/?search="
                + (
                    "a"
                    * 201
                )
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_sensitive_password_change_is_masked(
        self,
    ):
        content_type = (
            LogEntry.objects
            .model
        )

        from django.contrib.contenttypes.models import (
            ContentType,
        )

        user_content_type = (
            ContentType.objects.get_for_model(
                User
            )
        )

        LogEntry.objects.log_create(
            self.admin_a,
            action=(
                LogEntry.Action.UPDATE
            ),
            changes={
                "password": [
                    "old-secret-hash",
                    "new-secret-hash",
                ],
            },
        )

        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            "/api/activity/?model=user"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        password_changes = []

        for log in response.data[
            "logs"
        ]:
            for change in log[
                "changes"
            ]:
                if (
                    change["field"]
                    == "password"
                ):
                    password_changes.append(
                        change
                    )

        self.assertTrue(
            password_changes
        )

        self.assertEqual(
            password_changes[0][
                "old"
            ],
            "********",
        )

        self.assertEqual(
            password_changes[0][
                "new"
            ],
            "********",
        )
