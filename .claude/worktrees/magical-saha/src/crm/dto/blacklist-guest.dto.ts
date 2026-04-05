import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// HARD LIMIT: Guest blacklisting is always manual — never automated by AI or system rules
export class BlacklistGuestDto {
  @ApiProperty({
    description:
      'Mandatory reason for blacklisting. HARD LIMIT: this action is always manual — it MUST NOT be triggered by any automated rule, AI, or system process.',
    example: 'Repeated property damage and abusive behaviour toward staff',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
