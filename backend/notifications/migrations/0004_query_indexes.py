from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        (
            "notifications",
            "0003_notificationlog_driver_and_more",
        ),
    ]

    operations = [
        migrations.AddIndex(
            model_name="notificationlog",
            index=models.Index(
                fields=[
                    "organization",
                    "sent_at",
                ],
                name="notif_org_sent_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="notificationlog",
            index=models.Index(
                fields=[
                    "user",
                    "sent_at",
                ],
                name="notif_user_sent_idx",
            ),
        ),
    ]
