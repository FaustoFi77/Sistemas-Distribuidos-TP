import { HttpException, HttpStatus } from '@nestjs/common';

export interface FieldError {
  field: string;
  message: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  errors?: FieldError[];
}

export class ProblemException extends HttpException {
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly errors?: FieldError[];

  constructor(params: {
    status: HttpStatus | number;
    code: string;
    title: string;
    detail: string;
    errors?: FieldError[];
  }) {
    super(params.detail, params.status);
    this.code = params.code;
    this.title = params.title;
    this.detail = params.detail;
    this.errors = params.errors;
  }

  toProblemDetails(): ProblemDetails {
    const slug = this.code.toLowerCase().replace(/_/g, '-');
    const problem: ProblemDetails = {
      type: `https://iotplatform.ovenbirdconsulting.com.ar/problems/${slug}`,
      title: this.title,
      status: this.getStatus(),
      detail: this.detail,
      code: this.code,
    };
    if (this.errors && this.errors.length > 0) {
      problem.errors = this.errors;
    }
    return problem;
  }
}
