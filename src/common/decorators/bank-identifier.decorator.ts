import { BadRequestException } from '@nestjs/common'
import { Transform, TransformFnParams } from 'class-transformer'

/**
 * Rejects JSON numbers for bank identifier fields — they cannot preserve leading zeros
 * (e.g. 0343234). Must be sent as a quoted JSON string.
 * Uses the source object (`obj`) so validation runs before implicit string coercion.
 */
export function RejectNumericBankIdentifier(): PropertyDecorator {
  return Transform((params: TransformFnParams) => {
    const raw = Reflect.get(params.obj ?? {}, params.key)

    if (raw === undefined || raw === null) {
      return raw
    }
    if (typeof raw === 'number' || typeof raw === 'bigint') {
      throw new BadRequestException(
        `${String(params.key)} must be sent as a JSON string; numeric JSON values cannot preserve leading zeros`
      )
    }
    return raw
  })
}
