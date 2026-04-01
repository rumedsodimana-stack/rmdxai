import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';

export interface PaginationParams {
  skip: number;
  take: number;
  page: number;
}

@Injectable()
export class ParsePaginationPipe implements PipeTransform {
  transform(value: any, _metadata: ArgumentMetadata): PaginationParams {
    const page = Math.max(1, parseInt(value?.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(value?.limit) || 20));

    if (isNaN(page) || isNaN(limit)) {
      throw new BadRequestException('page and limit must be numbers');
    }

    return {
      skip: (page - 1) * limit,
      take: limit,
      page,
    };
  }
}
