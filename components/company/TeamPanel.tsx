import type { CompanyRole } from "@/lib/company-permissions";

// Samarbeid på en søker (sidepanelet på søkersiden): notater med @nevning og vurderingskort.
// P5 fyller inn.
export default async function TeamPanel(props: {
  applicationId: string;
  companyId: string;
  jobId: string;
  viewerId: string;
  role: CompanyRole;
  business: boolean;
}) {
  void props;
  return null;
}
