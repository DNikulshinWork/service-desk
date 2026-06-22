# Project Sprints Checklist

## Общий прогресс по спринтам
- [x] Sprint 0: инфраструктура и базовый запуск
- [x] Sprint 1: аутентификация, пользователи и компании
- [x] Sprint 2: заявки и комментарии
- [x] Sprint 3: база знаний
- [ ] Sprint 4: SLA и уведомления
- [ ] Sprint 5: интеграции и отчёты
- [ ] Sprint 6: документация и продакшен

## Sprint 0
- [x] Установлены зависимости
- [x] Docker Compose поднимает сервисы
- [x] Выполнена миграция Prisma
- [x] Smoke test `/health` проходит

## Sprint 1
- [x] Регистрация пользователя
- [x] Вход и выдача токенов
- [x] Refresh token flow
- [x] Logout flow
- [x] Middleware authentication
- [x] RBAC / role checks
- [x] OAuth endpoints (redirect + unsupported provider handling)
- [x] Профиль пользователя
- [x] CRUD компаний
- [x] Интеграционные тесты ключевых сценариев
- [x] Проверка ошибок и валидации

## Sprint 2
- [x] Создание заявки
- [x] Список заявок текущего пользователя
- [x] Детали заявки
- [x] Обновление заявки
- [x] Комментарии
- [x] Вложения
- [x] Фильтрация, пагинация и сортировка
- [x] Роли доступа для заявок
- [x] Интеграционные тесты для Sprint 2

## Sprint 3
- [x] Создание статьи базы знаний
- [x] Список статей и фильтры
- [x] Детальная статья
- [x] Редактирование и удаление статьи
- [x] Поиск по статьям
- [x] Оценка полезности статьи
- [ ] Связь заявки со статьёй
- [x] Интеграционные тесты для Sprint 3

## Sprint 4
- [ ] CRUD SLA-политик
- [ ] CRUD рабочих календарей
- [ ] Расчёт дедлайнов
- [ ] Статус SLA по заявке
- [ ] Автоматические задачи по дедлайнам
- [ ] Email/webhook уведомления
- [ ] Интеграционные тесты для Sprint 4

## Sprint 5
- [ ] Интеграции с Telegram/Slack
- [ ] Отчёты по статусам, агентам и CSAT
- [ ] Экспорт отчётов
- [ ] Кеширование отчётов
- [ ] Dashboard метрик
- [ ] Нагрузочное тестирование ключевых маршрутов

## Sprint 6
- [ ] Swagger/Scalar документация
- [ ] README и архитектурная документация
- [ ] CI/CD и деплой
- [ ] Kubernetes manifests
- [ ] HPA / PDB
- [ ] Sentry
- [ ] Playwright E2E
- [ ] Финальные нагрузочные тесты

## Проверка качества
- [x] Тесты API выполнены: `pnpm --filter @service-desk/api test`
- [x] Результат тестов: 12/12 файлов, 28/28 тестов успешно
- [x] Ошибки TypeScript/IDE для API не обнаружены

## Git / коммиты
- [x] Последние коммиты зафиксированы:
  - `feat(api): add knowledge base article feedback`
  - `feat(api): add article status management`
  - `feat(api): add knowledge base articles and categories`
  - `d156751` test(api): add tests for ticket filtering, sorting, and pagination
  - `768cba2` test(api): add integration test for sprint 2 flow
- [ ] При необходимости сделать следующий коммит после новых изменений

## Следующий шаг
- [x] Sprint 3 завершён
- [ ] Начать Sprint 4: SLA и уведомления
