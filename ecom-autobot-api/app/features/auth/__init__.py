from app.features.auth.domain import (
    AuthDomainError,
    EnterpriseLeadError,
    EnterpriseLeadModel,
    GoogleAuthError,
    InvalidCredentialsError,
    RoleModel,
    UserAlreadyExistsError,
    UserModel,
    hash_password,
    verify_password,
)
from app.features.auth.infrastructure import seed_admin_users, seed_initial_roles
from app.features.auth.repositories import UserRepository
from app.features.auth.schemas import (
    AuthenticatedUser,
    CreateUserRequest,
    LoginRequest,
    LogoutResponse,
    RoleResponse,
    UpdateUserRequest,
    UserInfo,
    UserResponse,
)
from app.features.auth.services import AuthService, EnterpriseLeadService, GoogleAuthService

__all__ = [
    # Domain
    "RoleModel",
    "UserModel",
    "EnterpriseLeadModel",
    "hash_password",
    "verify_password",
    "AuthDomainError",
    "UserAlreadyExistsError",
    "InvalidCredentialsError",
    "GoogleAuthError",
    "EnterpriseLeadError",
    # Repositories
    "UserRepository",
    # Schemas
    "AuthenticatedUser",
    "LoginRequest",
    "LogoutResponse",
    "CreateUserRequest",
    "UpdateUserRequest",
    "RoleResponse",
    "UserInfo",
    "UserResponse",
    # Services
    "AuthService",
    "GoogleAuthService",
    "EnterpriseLeadService",
    # Infrastructure
    "seed_initial_roles",
    "seed_admin_users",
]
