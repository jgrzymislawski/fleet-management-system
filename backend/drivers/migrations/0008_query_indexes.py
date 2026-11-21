from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        (
            "drivers",
            "0007_remove_driver_unique_driver_license_per_organization_and_more",
        ),
    ]

    operations = [
        migrations.AddIndex(
            model_name="driver",
            index=models.Index(
                fields=[
                    "organization",
                    "is_deleted",
                ],
                name="drv_org_deleted_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="driver",
            index=models.Index(
                fields=[
                    "organization",
                    "license_expiry_date",
                ],
                name="drv_org_lic_exp_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="driver",
            index=models.Index(
                fields=[
                    "organization",
                    "medical_exam_expiry_date",
                ],
                name="drv_org_med_exp_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="drivervehicleassignment",
            index=models.Index(
                fields=[
                    "vehicle",
                    "end_date",
                ],
                name="assign_vehicle_end_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="drivervehicleassignment",
            index=models.Index(
                fields=[
                    "driver",
                    "start_date",
                ],
                name="assign_driver_start_idx",
            ),
        ),
    ]
