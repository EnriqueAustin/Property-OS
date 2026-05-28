import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((body) => {
        if (body && typeof body === 'object' && 'data' in body && 'meta' in body) {
          return { success: true, ...body };
        }
        return { success: true, data: body };
      }),
    );
  }
}
