import { Department, UserRole } from '../enum';

export interface IRagSearchOptions {
  user: {
    role: UserRole;
    department: Department;
  };
  query: string;
  departmentFilter?: Department;
  limit?: number;
  minScore?: number;
}
