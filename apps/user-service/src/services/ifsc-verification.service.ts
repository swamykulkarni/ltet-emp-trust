export interface IFSCDetails {
  ifsc: string;
  bank: string;
  branch: string;
  address: string;
  city: string;
  state: string;
  contact?: string;
  rtgs: boolean;
  neft: boolean;
  imps: boolean;
  upi: boolean;
}

export interface IFSCVerificationResult {
  success: boolean;
  valid: boolean;
  details?: IFSCDetails;
  error?: string;
}

export class IFSCVerificationService {
  private readonly IFSC_API_BASE_URL = 'https://ifsc.razorpay.com';

  /**
   * Verify IFSC code and get bank details
   */
  async verifyIFSC(ifscCode: string): Promise<IFSCVerificationResult> {
    try {
      // Basic format validation
      if (!this.isValidIFSCFormat(ifscCode)) {
        return {
          success: true,
          valid: false,
          error: 'Invalid IFSC code format. IFSC should be 11 characters: 4 letters, 1 zero, 6 alphanumeric characters.'
        };
      }

      // Call external API for verification
      const response = await fetch(`${this.IFSC_API_BASE_URL}/${ifscCode.toUpperCase()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.status === 404) {
        return {
          success: true,
          valid: false,
          error: 'IFSC code not found. Please verify the code with your bank.'
        };
      }

      if (!response.ok) {
        // Fallback to basic validation if API is unavailable
        return this.fallbackValidation(ifscCode);
      }

      const data = await response.json();

      const details: IFSCDetails = {
        ifsc: data.IFSC,
        bank: data.BANK,
        branch: data.BRANCH,
        address: data.ADDRESS,
        city: data.CITY,
        state: data.STATE,
        contact: data.CONTACT,
        rtgs: data.RTGS === true,
        neft: data.NEFT === true,
        imps: data.IMPS === true,
        upi: data.UPI === true
      };

      return {
        success: true,
        valid: true,
        details
      };
    } catch (error: any) {
      // Fallback to basic validation if API call fails
      return this.fallbackValidation(ifscCode);
    }
  }

  /**
   * Batch verify multiple IFSC codes
   */
  async verifyMultipleIFSC(ifscCodes: string[]): Promise<Record<string, IFSCVerificationResult>> {
    const results: Record<string, IFSCVerificationResult> = {};
    
    // Process in parallel with a limit to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < ifscCodes.length; i += batchSize) {
      const batch = ifscCodes.slice(i, i + batchSize);
      const batchPromises = batch.map(async (ifsc) => {
        const result = await this.verifyIFSC(ifsc);
        return { ifsc, result };
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ ifsc, result }) => {
        results[ifsc] = result;
      });

      // Small delay between batches to be respectful to the API
      if (i + batchSize < ifscCodes.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Get bank name from IFSC code (first 4 characters)
   */
  getBankCodeFromIFSC(ifscCode: string): string {
    if (!ifscCode || ifscCode.length < 4) {
      return '';
    }
    return ifscCode.substring(0, 4).toUpperCase();
  }

  /**
   * Check if IFSC format is valid
   */
  private isValidIFSCFormat(ifscCode: string): boolean {
    if (!ifscCode || ifscCode.length !== 11) {
      return false;
    }

    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscRegex.test(ifscCode.toUpperCase());
  }

  /**
   * Fallback validation when API is unavailable
   */
  private fallbackValidation(ifscCode: string): IFSCVerificationResult {
    const isValidFormat = this.isValidIFSCFormat(ifscCode);
    
    if (!isValidFormat) {
      return {
        success: true,
        valid: false,
        error: 'Invalid IFSC code format. IFSC should be 11 characters: 4 letters, 1 zero, 6 alphanumeric characters.'
      };
    }

    // Basic validation passed, but we couldn't verify with external service
    return {
      success: true,
      valid: true,
      details: {
        ifsc: ifscCode.toUpperCase(),
        bank: this.getBankNameFromCode(this.getBankCodeFromIFSC(ifscCode)),
        branch: 'Branch details unavailable',
        address: 'Address unavailable',
        city: 'City unavailable',
        state: 'State unavailable',
        rtgs: true, // Assume standard services are available
        neft: true,
        imps: true,
        upi: true
      }
    };
  }

  /**
   * Get bank name from bank code (basic mapping)
   */
  private getBankNameFromCode(bankCode: string): string {
    const bankCodes: Record<string, string> = {
      'SBIN': 'State Bank of India',
      'HDFC': 'HDFC Bank',
      'ICIC': 'ICICI Bank',
      'AXIS': 'Axis Bank',
      'PUNB': 'Punjab National Bank',
      'UBIN': 'Union Bank of India',
      'CNRB': 'Canara Bank',
      'BARB': 'Bank of Baroda',
      'IOBA': 'Indian Overseas Bank',
      'BKID': 'Bank of India',
      'CBIN': 'Central Bank of India',
      'CORP': 'Corporation Bank',
      'INDB': 'Indian Bank',
      'ALLA': 'Allahabad Bank',
      'VIJB': 'Vijaya Bank',
      'ANDB': 'Andhra Bank',
      'ORBC': 'Oriental Bank of Commerce',
      'UTIB': 'Axis Bank', // Alternative code
      'KKBK': 'Kotak Mahindra Bank',
      'YESB': 'Yes Bank',
      'IDIB': 'Indian Bank',
      'IBKL': 'IDBI Bank'
    };

    return bankCodes[bankCode] || `Bank (${bankCode})`;
  }
}