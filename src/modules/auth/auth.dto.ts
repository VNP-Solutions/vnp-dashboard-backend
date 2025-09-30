import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min
} from 'class-validator'

export class LoginRequestOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string
}

export class VerifyLoginOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string

  @IsNumber()
  @IsNotEmpty()
  @Min(100000)
  @Max(999999)
  otp: number
}

export class InviteUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string

  @IsString()
  @IsNotEmpty()
  role_id: string

  @IsString()
  @IsNotEmpty()
  first_name: string

  @IsString()
  @IsNotEmpty()
  last_name: string

  @IsString()
  @IsNotEmpty()
  language: string

  @IsArray()
  @IsOptional()
  portfolio_ids?: string[]

  @IsArray()
  @IsOptional()
  property_ids?: string[]
}

export class VerifyInvitationDto {
  @IsEmail()
  @IsNotEmpty()
  email: string

  @IsString()
  @IsNotEmpty()
  temp_password: string

  @IsString()
  @IsNotEmpty()
  @Matches(
    /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,32}$/,
    {
      message:
        'Password must be 8-32 characters long and contain at least one letter, one number, and one special character'
    }
  )
  new_password: string
}

export class RequestPasswordResetDto {
  @IsEmail()
  @IsNotEmpty()
  email: string
}

export class ResetPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string

  @IsNumber()
  @IsNotEmpty()
  @Min(100000)
  @Max(999999)
  otp: number

  @IsString()
  @IsNotEmpty()
  @Matches(
    /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,32}$/,
    {
      message:
        'Password must be 8-32 characters long and contain at least one letter, one number, and one special character'
    }
  )
  new_password: string
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refresh_token: string
}

export class AuthResponseDto {
  access_token: string
  refresh_token: string
  user: {
    id: string
    email: string
    first_name: string
    last_name: string
    role: string
  }
}
