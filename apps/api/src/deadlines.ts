
interface SlaPolicy {
  id: string;
  name: string;
  priority: string;
  responseTime: number; // in hours
  resolveTime: number; // in hours
}

interface WorkingCalendar {
  id: string;
  name: string;
  timezone: string;
  workingDays: number[]; // 0=Sunday, 6=Saturday
  workingHours: { start: string; end: string }; // e.g., { start: '09:00', end: '17:00' }
}

export function calculateDeadline(
  createdAt: number,
  slaPolicy: SlaPolicy,
  calendar: WorkingCalendar,
  hours: number
): number {
  const deadline = new Date(createdAt);
  let hoursRemaining = hours;

  while (hoursRemaining > 0) {
    deadline.setHours(deadline.getHours() + 1);

    const dayOfWeek = deadline.getDay(); // 0=Sunday, 6=Saturday
    const hourOfDay = deadline.getHours();

    const isWorkingDay = calendar.workingDays.includes(dayOfWeek);
    const [startHour] = calendar.workingHours.start.split(':').map(Number);
    const [endHour] = calendar.workingHours.end.split(':').map(Number);

    if (isWorkingDay && hourOfDay >= startHour && hourOfDay < endHour) {
      hoursRemaining--;
    }
  }

  return deadline.getTime();
}
