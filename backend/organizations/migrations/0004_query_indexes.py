from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        (
            "organizations",
            "0003_companyaccess",
        ),
    ]

    operations = [
        migrations.AddIndex(
            model_name="company",
            index=models.Index(
                fields=[
                    "organization",
                    "is_active",
                ],
                name="company_org_active_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="organizationmembership",
            index=models.Index(
                fields=[
                    "organization",
                    "role",
                ],
                name="membership_org_role_idx",
            ),
        ),
    ]
