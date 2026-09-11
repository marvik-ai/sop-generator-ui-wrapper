export type SubTask = {
  name: string;
  description?: string;
};

export type Task = {
  name: string;
  description?: string;
  subTasks: SubTask[];
};

export type Phase = {
  name: string;
  tasks: Task[];
};

export const TASK_TAXONOMY: Phase[] = [
  {
    name: 'Claim Intake',
    tasks: [
      {
        name: 'Claim Received',
        description:
          'Initial intake of the claim into FINEOS/system, capturing claimant, employer, and plan identifiers, leave reasons, requested dates, and submission channel',
        subTasks: [],
      },
      {
        name: 'Claim Review',
        subTasks: [
          {
            name: 'Last day worked / Earnings test',
            description:
              'Verifying Date Last Worked (DLW) against Date of Disability thresholds (5+ calendar days gap check) and reviewing wage/earnings data against option codes to establish eligible STD payment bases',
          },
          {
            name: 'Recurrency check',
            description:
              'Checking for existing certified benefit periods or active claims in FINEOS to prevent duplicate claim processing or handle recurring disability conditions',
          },
          {
            name: 'Coverage verification',
            description:
              'Confirming policy coverage (option code, sub-code, sub-point, effective dates) by querying legacy mainframes (UIS/UDS) via the Coverage Verification eForm',
          },
        ],
      },
      {
        name: 'Request for Medical Information',
        subTasks: [
          {
            name: 'Provider setup & work pattern',
            description:
              'Capturing healthcare provider details and recording claimant work patterns (days/hours worked) to evaluate availability and establish medical request parameters',
          },
          {
            name: 'Wage information (Stat DI, PFML)',
            description:
              'Requesting or reviewing statutory disability insurance (Stat DI) and state Paid Family Medical Leave (PFML) wage details for statutory compliance and offset calculations',
          },
          {
            name: 'Salary continuance code check',
            description:
              'Verifying salary continuance codes (e.g., Code 7 = ATP Dates Only) to determine whether partial pay or salary continuation rules apply',
          },
          {
            name: 'Pre-existing periods',
            description:
              "Reviewing pre-existing condition limitations and duration limits on the employer's plan configuration prior to initial decisioning",
          },
          {
            name: 'Medical Reminders',
            description:
              'Sending automated reminders to the claimant or provider for missing actual delivery dates, delivery types, or outstanding medical documentation',
          },
        ],
      },
      {
        name: 'Acknowledgement Package Sent',
        description:
          'Automatically generating and sending receipt confirmation / welcome packages to the claimant and manager letters to the employer',
        subTasks: [],
      },
      {
        name: 'Assign Claim by Unit Leader',
        description:
          'Routing the claim to a specific Unit Leader (UL) / Case Manager queue for manual or automated processing',
        subTasks: [],
      },
    ],
  },
  {
    name: 'Claim Decisioning',
    tasks: [
      {
        name: 'Initial Interview',
        subTasks: [{ name: 'Complete initial interview' }],
      },
      {
        name: 'Update Claim',
        subTasks: [
          {
            name: 'Document initial interview',
            description:
              'Formally recording the interview findings in FINEOS by completing the Interview eForm',
          },
          { name: 'Add key dates' },
          { name: 'Add hospitalization details' },
        ],
      },
      {
        name: 'Review Documents',
        subTasks: [
          { name: 'Review medical documents' },
          { name: 'Review incoming texts, phone calls' },
          { name: 'Review financial documents' },
        ],
      },
      {
        name: 'Request for Missing Documents from Employer',
        subTasks: [],
      },
      {
        name: 'Behavioral Claim Evaluation',
        description:
          'Performing specialized clinical evaluation for mental health or substance abuse claims excluded from standard Simplified Claim Process (SCP) pre-approvals',
        subTasks: [],
      },
      {
        name: 'Process Claim',
        subTasks: [
          {
            name: 'Functional capacity & disability determination',
            description:
              'Evaluating physical job demands (Job Strength mapping: sedentary, light, medium, heavy) against ICD-10 medical codes and MD Guidelines recovery limits',
          },
          { name: 'Apply duration & benefit dates' },
          {
            name: 'Situs / Residence state rules',
            description:
              'Evaluating state-specific statutory regulations (e.g., statutory disability / PFL plans in NY, NJ, CA, PR, HI)',
          },
          {
            name: 'Manage offsets',
            description:
              'Identifying and deducting benefit amounts received from other public/private sources to avoid duplicate payments',
          },
          {
            name: 'Premium deductions',
            description:
              'Loading and applying customer premium deduction/wage info into database tables for benefit payroll adjustments',
          },
        ],
      },
      {
        name: 'Adjudicate Claim',
        subTasks: [
          {
            name: 'Decision communication',
            description:
              'Formally approving or denying the claim, filing the Action Plan and Decision Summary eForms, and issuing decision letters',
          },
        ],
      },
    ],
  },
  {
    name: 'Ongoing Management',
    tasks: [
      { name: 'Process payments', subTasks: [] },
      { name: 'Payment letters', subTasks: [] },
      { name: 'Manage Overpayments >$500', subTasks: [] },
      { name: 'Manage Overpayments <$500', subTasks: [] },
      { name: 'Claimant Check Ins and Call Back*', subTasks: [] },
      { name: 'Adjudicate Extension Requests*', subTasks: [] },
    ],
  },
  {
    name: 'Disability Closure',
    tasks: [
      { name: 'Return to Work', subTasks: [] },
      { name: 'Bridge to LTD', subTasks: [] },
      { name: 'Max Duration Completed', subTasks: [] },
      { name: 'Appeals Referrals', subTasks: [] },
    ],
  },
];
