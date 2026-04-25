from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    username: str
    full_name: str
    role: str
    favorite_team: str
    favorite_driver: str
    location: str
    profile_image: str
    bio: str


class UserProfileUpdate(BaseModel):
    full_name: str
    role: str
    favorite_team: str
    favorite_driver: str
    location: str
    profile_image: str
    bio: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
