// Content preserved from the original UnCooked design.
export const steps = [
  ['01', 'Sign in to your workspace', 'Use the credentials provided by your institution administrator to enter your dedicated role workspace—Administrator, Examiner, or Candidate.'],
  ['02', 'Build from the Question Bank', 'Examiners organize reusable MCQs, multi-select, and written questions, then drag and drop them directly into scheduled examinations.'],
  ['03', 'Take the exam with live sync', 'Candidates start within the server-enforced window, flag questions for review, and work seamlessly even if the connection flickers.'],
  ['04', 'Grade, publish & verify PDFs', 'Examiners monitor incidents, grade written responses, publish results, and issue cryptographically verifiable PDF score reports.'],
]

export const roleCards = [
  ['Examiners', 'Build & invigilate', 'Create question banks, drag-and-drop into exams, monitor active attempts in real time, grade written answers, and view question analytics.', '◈'],
  ['Candidates', 'Focus & submit', 'Distraction-free exam workspace with live countdown, question navigator, review flags, scratchpad, and instant submission receipts.', '◉'],
  ['Administrators', 'Govern & scale', 'Manage user accounts, roles, and access states, or bulk-import hundreds of candidates via editable JSON preview.', '◆'],
]

export const faqs = [
  ['What happens if a candidate refreshes or loses internet mid-exam?', 'Every answer and review flag is saved both locally and to the server. When the candidate reconnects or refreshes, their exact progress and server-enforced deadline are restored automatically.'],
  ['Can a candidate extend their exam time by changing their device clock?', 'No. All start times, deadlines, and auto-submissions are enforced by the server clock, ensuring strict fairness across every attempt.'],
  ['How does bulk JSON import work for users and questions?', 'Upload a JSON array of up to 200 records, preview and edit any field inline—including fixing duplicate emails or typos—and confirm the import in one click.'],
  ['How can institutions verify a candidate’s PDF report?', 'Every published PDF report includes a unique verification token and link that anyone can validate against the public verification endpoint.'],
]

export const examRows = [
  ['WEB101', 'Web fundamentals', '09:00 AM', '20 min'],
  ['CS201', 'Data structures', '10:00 AM', '30 min'],
  ['CS301', 'Database systems', '11:30 AM', '45 min'],
  ['SE201', 'Software engineering', '02:00 PM', '30 min'],
  ['NET101', 'Computer networks', '03:00 PM', '25 min'],
]

