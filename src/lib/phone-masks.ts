// Country calling codes with phone masks
export interface CountryCode {
  code: string;
  dial: string;
  flag: string;
  mask: string; // # = digit
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: "BR", dial: "+55", flag: "🇧🇷", mask: "(##) #####-####" },
  { code: "US", dial: "+1", flag: "🇺🇸", mask: "(###) ###-####" },
  { code: "AR", dial: "+54", flag: "🇦🇷", mask: "(##) ####-####" },
  { code: "CL", dial: "+56", flag: "🇨🇱", mask: "# ####-####" },
  { code: "CO", dial: "+57", flag: "🇨🇴", mask: "### ###-####" },
  { code: "PE", dial: "+51", flag: "🇵🇪", mask: "### ###-###" },
  { code: "UY", dial: "+598", flag: "🇺🇾", mask: "## ###-###" },
  { code: "PY", dial: "+595", flag: "🇵🇾", mask: "### ###-###" },
  { code: "BO", dial: "+591", flag: "🇧🇴", mask: "# ###-####" },
  { code: "EC", dial: "+593", flag: "🇪🇨", mask: "## ###-####" },
  { code: "VE", dial: "+58", flag: "🇻🇪", mask: "### ###-####" },
  { code: "MX", dial: "+52", flag: "🇲🇽", mask: "(##) ####-####" },
  { code: "CA", dial: "+1", flag: "🇨🇦", mask: "(###) ###-####" },
  { code: "PT", dial: "+351", flag: "🇵🇹", mask: "### ###-###" },
  { code: "ES", dial: "+34", flag: "🇪🇸", mask: "### ## ## ##" },
  { code: "FR", dial: "+33", flag: "🇫🇷", mask: "# ## ## ## ##" },
  { code: "DE", dial: "+49", flag: "🇩🇪", mask: "### #######" },
  { code: "IT", dial: "+39", flag: "🇮🇹", mask: "### ###-####" },
  { code: "GB", dial: "+44", flag: "🇬🇧", mask: "#### ######" },
  { code: "JP", dial: "+81", flag: "🇯🇵", mask: "##-####-####" },
  { code: "CN", dial: "+86", flag: "🇨🇳", mask: "###-####-####" },
  { code: "IN", dial: "+91", flag: "🇮🇳", mask: "#####-#####" },
  { code: "AU", dial: "+61", flag: "🇦🇺", mask: "### ###-###" },
  { code: "AE", dial: "+971", flag: "🇦🇪", mask: "## ###-####" },
  { code: "IL", dial: "+972", flag: "🇮🇱", mask: "##-###-####" },
  { code: "ZA", dial: "+27", flag: "🇿🇦", mask: "## ###-####" },
  { code: "KR", dial: "+82", flag: "🇰🇷", mask: "##-####-####" },
];

export function applyPhoneMask(value: string, mask: string): string {
  const digits = value.replace(/\D/g, "");
  let result = "";
  let digitIndex = 0;

  for (let i = 0; i < mask.length && digitIndex < digits.length; i++) {
    if (mask[i] === "#") {
      result += digits[digitIndex];
      digitIndex++;
    } else {
      result += mask[i];
      // If the next input digit matches a literal, skip
    }
  }

  return result;
}

export function getCountryCodeByDial(dial: string): CountryCode | undefined {
  return COUNTRY_CODES.find((c) => c.dial === dial);
}

export function stripMask(value: string): string {
  return value.replace(/\D/g, "");
}
