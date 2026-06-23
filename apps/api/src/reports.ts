
import { getAllTickets, getAllUsers } from './auth.js';

// 1. Отчёт по статусам заявок
export function getTicketStatusReport() {
  const tickets = getAllTickets({ limit: 1000 }); // Получаем все заявки

  const statusCounts = tickets.reduce((acc, ticket) => {
    acc[ticket.status] = (acc[ticket.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalTickets: tickets.length,
    byStatus: statusCounts,
    // Дополнительно можно добавить процентное соотношение
    distribution: Object.keys(statusCounts).reduce((acc, status) => {
      acc[status] = parseFloat(((statusCounts[status] / tickets.length) * 100).toFixed(2));
      return acc;
    }, {} as Record<string, number>),
  };
}

// 2. Отчёт по производительности агентов
export function getAgentPerformanceReport() {
  const tickets = getAllTickets({ limit: 1000 });
  const agents = getAllUsers().filter(u => u.role === 'ADMIN' || u.role === 'AGENT');

  const agentStats = agents.map(agent => {
    const assignedTickets = tickets.filter(t => t.assigneeId === agent.id);
    const resolvedTickets = assignedTickets.filter(t => t.status === 'RESOLVED');

    return {
      agentId: agent.id,
      agentName: agent.name,
      assigned: assignedTickets.length,
      resolved: resolvedTickets.length,
    };
  });

  return { data: agentStats };
}

// 3. Отчёт по CSAT (удовлетворённости клиентов)
// Для этого нам понадобится модель для хранения оценок, которой пока нет.
// Пока что вернём заглушку.
export function getCsatReport() {
  // В будущем здесь будет логика на основе реальных оценок
  return {
    averageScore: 4.5, // Примерное среднее значение
    totalRatings: 150, // Примерное количество оценок
    distribution: {
      '5_stars': 100,
      '4_stars': 30,
      '3_stars': 10,
      '2_stars': 5,
      '1_star': 5,
    },
  };
}
