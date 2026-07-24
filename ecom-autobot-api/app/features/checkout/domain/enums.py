from enum import Enum


class OrderType(str, Enum):
    ONLINE = "online"


class CaptureMode(str, Enum):
    AUTOMATIC = "automatic"
    MANUAL = "manual"
    AUTOMATIC_ASYNC = "automatic_async"


class ProcessingMode(str, Enum):
    AUTOMATIC = "automatic"
    MANUAL = "manual"


class PaymentMethodId(str, Enum):
    VISA = "visa"
    MASTER = "master"
    DEBELO = "debelo"
    BOLETO = "boleto"
    PIX = "pix"


class PaymentMethodType(str, Enum):
    CREDIT_CARD = "credit_card"
    DEBIT_CARD = "debit_card"
    TICKET = "ticket"
    BANK_TRANSFER = "bank_transfer"


class OrderStatus(str, Enum):
    CREATED = "created"
    PROCESSED = "processed"
    ACTION_REQUIRED = "action_required"
    PROCESSING = "processing"
    CANCELED = "canceled"


class OrderStatusDetail(str, Enum):
    CREATED = "created"
    ACCREDITED = "accredited"
    IN_PROCESS = "in_process"
    IN_REVIEW = "in_review"
    WAITING_PAYMENT = "waiting_payment"
    WAITING_CAPTURE = "waiting_capture"
    WAITING_TRANSFER = "waiting_transfer"
    PENDING_WAITING_PAYMENT = "pending_waiting_payment"


class ThreeDSValidation(str, Enum):
    ON_FRAUD_RISK = "on_fraud_risk"
    NEVER = "never"


class LiabilityShift(str, Enum):
    REQUIRED = "required"
