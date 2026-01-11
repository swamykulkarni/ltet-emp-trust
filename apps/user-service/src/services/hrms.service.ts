import { environment } from '../environments/environment';

export interface HRMSEmployeeData {
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  department: string;
  ic: string;
  joiningDate: Date;
  retirementDate?: Date;
  status: 'active' | 'retired';
}

export interface HRMSServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class HRMSService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = environment.hrms.baseUrl;
    this.apiKey = environment.hrms.apiKey;
  }

  async getEmployeeData(employeeId: string): Promise<HRMSServiceResult<HRMSEmployeeData>> {
    try {
      const response = await fetch(`${this.baseUrl}/employees/${employeeId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: 'Employee not found in HRMS'
          };
        }
        return {
          success: false,
          error: `HRMS API error: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();
      
      // Transform HRMS data to our format
      const employeeData: HRMSEmployeeData = {
        employeeId: data.employee_id,
        name: data.full_name,
        email: data.email_address,
        phone: data.phone_number,
        address: {
          street: data.address?.street || '',
          city: data.address?.city || '',
          state: data.address?.state || '',
          pincode: data.address?.pincode || '',
          country: data.address?.country || 'India'
        },
        department: data.department,
        ic: data.independent_company,
        joiningDate: new Date(data.joining_date),
        retirementDate: data.retirement_date ? new Date(data.retirement_date) : undefined,
        status: data.employment_status === 'ACTIVE' ? 'active' : 'retired'
      };

      return {
        success: true,
        data: employeeData
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch employee data from HRMS'
      };
    }
  }

  async validateEmployee(employeeId: string): Promise<HRMSServiceResult<boolean>> {
    try {
      const result = await this.getEmployeeData(employeeId);
      return {
        success: true,
        data: result.success
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to validate employee'
      };
    }
  }

  async syncEmployeeBatch(employeeIds: string[]): Promise<HRMSServiceResult<HRMSEmployeeData[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/employees/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ employee_ids: employeeIds })
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HRMS batch API error: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();
      const employees: HRMSEmployeeData[] = data.employees.map((emp: any) => ({
        employeeId: emp.employee_id,
        name: emp.full_name,
        email: emp.email_address,
        phone: emp.phone_number,
        address: {
          street: emp.address?.street || '',
          city: emp.address?.city || '',
          state: emp.address?.state || '',
          pincode: emp.address?.pincode || '',
          country: emp.address?.country || 'India'
        },
        department: emp.department,
        ic: emp.independent_company,
        joiningDate: new Date(emp.joining_date),
        retirementDate: emp.retirement_date ? new Date(emp.retirement_date) : undefined,
        status: emp.employment_status === 'ACTIVE' ? 'active' : 'retired'
      }));

      return {
        success: true,
        data: employees
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to sync employee batch from HRMS'
      };
    }
  }

  async getEmployeesByDepartment(department: string): Promise<HRMSServiceResult<HRMSEmployeeData[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/employees?department=${encodeURIComponent(department)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HRMS API error: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();
      const employees: HRMSEmployeeData[] = data.employees.map((emp: any) => ({
        employeeId: emp.employee_id,
        name: emp.full_name,
        email: emp.email_address,
        phone: emp.phone_number,
        address: {
          street: emp.address?.street || '',
          city: emp.address?.city || '',
          state: emp.address?.state || '',
          pincode: emp.address?.pincode || '',
          country: emp.address?.country || 'India'
        },
        department: emp.department,
        ic: emp.independent_company,
        joiningDate: new Date(emp.joining_date),
        retirementDate: emp.retirement_date ? new Date(emp.retirement_date) : undefined,
        status: emp.employment_status === 'ACTIVE' ? 'active' : 'retired'
      }));

      return {
        success: true,
        data: employees
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch employees by department from HRMS'
      };
    }
  }
}