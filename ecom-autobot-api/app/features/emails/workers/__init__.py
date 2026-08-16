from app.features.emails.workers.email_batch_worker import EmailBatchWorker, email_batch_worker

EmailWorker = EmailBatchWorker

__all__ = ["EmailBatchWorker", "email_batch_worker", "EmailWorker"]
