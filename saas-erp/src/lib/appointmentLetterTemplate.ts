import { formatDate, numberToWords } from './utils';

/**
 * The standard Edge School 11-point appointment contract terms
 */
export const DEFAULT_APPOINTMENT_TERMS = `1. Appointment & Probation
•	You will initially be appointed on a three (3) month probation period.
•	During probation, your performance and conduct will be evaluated on a regular basis.
•	The school may terminate employment during this period without notice.
•	Upon successful completion of probation, you will receive a written confirmation of appointment.
•	You will be considered a regular employee after completion of one year.

2. Remuneration
•	You will receive a monthly gross salary of PKR {{SALARY}}/= ({{SALARY_WORDS}} only)
•	payable between the 10th and 15th of every month.
•	Statutory deductions, where applicable, will be made from your salary.
•	Submission of your complete academic documents, CNIC and NTN (if applicable) is mandatory at the time of joining.
•	As per policy, one month’s salary will be held as security and shall be payable at the time of resignation after completion of all formalities.

3. Working Hours
•	Your weekly working will be, Monday to Saturday, in accordance with the school timetable.
•	You may be required to perform additional duties for academic support, meetings, parent-teacher sessions, examination duties, or school events.

4. Leave Entitlement
•	Casual/Medical Leave:
	o	First year: 6 days
	o	From second year: 10 days per year
•	Public Holidays: As per the school calendar.
•	Summer Vacation Salary: Payable only upon completion of a full academic year and according to school policy.
•	Without prior approval you will be considered absent from duty and two days salary will be deducted for every single absent. Approval means application for leave signed or email received in this regard. In case of medical leave, a medical certificate from MBBS doctor is mandatory. Paid leaves cannot be more than three in a month in any case. In the first year of service, you will only be paid for your working days and not for any type of non gazetted holidays except the annual leave.
•	You are required to be punctual, a deduction of 1/4th of the salary will be made in case of late arrival or early departure.

5. Code of Conduct & Professional Ethics
You are required to conduct yourself in a manner that upholds the values of {{SCHOOL_NAME}}. This includes:
•	Maintaining professional attire as per the staff dress code.
•	Ensuring confidentiality regarding student records, school operations, and employee information.
•	Avoiding all forms of secondary employment unless approved in writing by the school.
•	Refraining from political activities, public statements, or behavior that may affect the school’s reputation.
•	Strictly adhering to the policy that prohibits teachers from collecting cash or payments on behalf of the school.

6. Academic & Discipline Policy
{{SCHOOL_NAME}} maintains a zero-tolerance policy toward any form of physical or verbal abuse of students.
Disciplinary concerns must be addressed through the official process, including:
•	Parent communication
•	Diary notes
•	Reporting to the Principal and Director.
Any violation of this policy may result in immediate termination.

7. Resignation & Notice Period
•	You cannot leave the organization except during academic session. Resign must come at the end of session, otherwise your one-month salary along with any security with school, will be deducted. If you have submitted your original degree then degree will only be returned after the deposit of one month salary submitted in lie will be confiscated. Besides this, if school has given you certain free training, then you cannot leave the school before one year or as mentioned at the time of training. In case of training if you want to leave before the speculated time, you will be required to pay the cost of training.

8. Termination
The school reserves the right to terminate your employment in cases involving:
•	Professional misconduct
•	Negligence or breach of policy
•	Unsatisfactory performance
•	Any act deemed detrimental to school interests

9. School Property & Data
All school property equipment, materials, documents, digital accounts, and academic content—remains the sole property of {{SCHOOL_NAME}}.
You must return all items and provide account access credentials during the clearance process at the time of separation.

10. Service Certificate
You will not be given any service or other certificate from the school before the completion of one year or if proper resignation is not given at the time of resign. The original appointment letter shall be submitted at the time of resignation for obtaining experience certificate. No letter shall be issued without the submission of the appointment letter in original.

11. Session Commitment
This appointment is being made for the complete academic session. By signing this appointment letter, you agree and are expected to remain in the service of {{SCHOOL_NAME}} and continue your assigned duties until the completion of the academic session, {{SESSION_END}}. You are therefore expected to remain with the school and fulfill your responsibilities until {{SESSION_END}}, unless otherwise permitted by the management under applicable terms and conditions.`;

/**
 * Calculates academic session end month & year (e.g. February 2027)
 */
export function getAppointmentSessionEnd(joiningDateStr?: string | null): string {
  const d = joiningDateStr ? new Date(joiningDateStr) : new Date();
  const year = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
  // Pakistan academic sessions typically conclude in February of the following year
  const endYear = d.getMonth() >= 2 ? year + 1 : year;
  return `February ${endYear}`;
}

/**
 * Replaces dynamic placeholders in the appointment template
 */
export function interpolateAppointmentTemplate(
  template: string,
  staff: any,
  schoolInfo: any
): string {
  if (!template) return '';

  const salaryNum = Number(staff?.salary) || 0;
  const salaryFormatted = salaryNum > 0 ? salaryNum.toLocaleString() : '15,000';
  const salaryWords = salaryNum > 0 ? numberToWords(salaryNum) : 'Fifteen Thousand';
  const joiningDateFormatted = staff?.joining_date ? formatDate(staff.joining_date) : formatDate(new Date());
  const sessionEnd = getAppointmentSessionEnd(staff?.joining_date);
  const schoolName = schoolInfo?.name || 'The School';
  const directorName = schoolInfo?.director_name || schoolInfo?.signatory_name || 'Authorized Signatory';
  const cnic = staff?.cnic || '_____________________';
  const contact = staff?.mobile_number || staff?.whatsapp_number || '_____________________';
  const staffName = staff?.full_name || '_____________________';
  const role = staff?.role || 'Montessori School Teacher';
  const fatherName = staff?.father_name || '';
  const qualification = staff?.qualification || '';
  const department = staff?.department || '';
  const address = staff?.address || '';
  const gender = staff?.gender || '';
  const honorific = gender.toLowerCase() === 'female' ? 'Ms./Mrs.' : 'Mr.';

  const replacements: Record<string, string> = {
    '{{STAFF_NAME}}': staffName,
    '{{HONORIFIC}}': honorific,
    '{{ROLE}}': role,
    '{{SALARY}}': salaryFormatted,
    '{{SALARY_WORDS}}': salaryWords,
    '{{CNIC}}': cnic,
    '{{CONTACT}}': contact,
    '{{MOBILE}}': contact,
    '{{PHONE}}': contact,
    '{{FATHER_NAME}}': fatherName,
    '{{QUALIFICATION}}': qualification,
    '{{DEPARTMENT}}': department,
    '{{ADDRESS}}': address,
    '{{JOINING_DATE}}': joiningDateFormatted,
    '{{EFFECTIVE_DATE}}': joiningDateFormatted,
    '{{SCHOOL_NAME}}': schoolName,
    '{{DIRECTOR_NAME}}': directorName,
    '{{SESSION_END}}': sessionEnd,
    '{{DATE}}': formatDate(new Date()),
    '{{REF_NO}}': `TES/HR/APP/${staff?.id ? String(staff.id).substring(0, 8).toUpperCase() : '________'}`,
  };

  let rendered = template;
  Object.entries(replacements).forEach(([key, val]) => {
    rendered = rendered.split(key).join(val);
  });

  // Also replace any raw hardcoded salary phrases if pasted literally
  rendered = rendered.replace(
    /PKR[_\s]*15,?000\/=\s*\((Fifteen\s+thousand\s+only|Fifteen\s+Thousand\s+only)\)/gi,
    `PKR ${salaryFormatted}/= (${salaryWords} only)`
  );

  return rendered;
}
