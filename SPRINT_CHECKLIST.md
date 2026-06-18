# Sprint Checklist

## Текущий этап
- [x] Sprint 0: инфраструктура и базовый запуск
- [x] Sprint 1: аутентификация, пользователи и компании
- [ ] Sprint 2: заявки и комментарии
- [ ] Sprint 3: база знаний
- [ ] Sprint 4: SLA и уведомления
- [ ] Sprint 5: интеграции и отчёты
- [ ] Sprint 6: документация и продакшен

## Текущий статус по Sprint 1
- [x] Регистрация пользователя
- [x] Вход и выдача токенов
- [x] Refresh token flow
- [x] Logout flow
- [x] Middleware authentication
- [x] RBAC / role checks
- [x] OAuth endpoints (redirect + unsupported provider handling)
- [x] Профиль пользователя
- [x] CRUD компаний
- [x] Интеграционные тесты для ключевых сценариев
- [x] Проверка ошибок/валидации

## Проверка качества
- [x] Тесты API выполнены: `pnpm --filter @service-desk/api test`
- [x] Результат тестов: 10/10 файлов, 19/19 тестов успешно
- [x] Ошибки TypeScript/IDE для API не обнаружены

## Git / коммиты
- [x] Последние коммиты сделаны и содержат подтверждённые изменения:
  - `dfb28b6` fix(api): support admin user listing
  - `0e22e7b` fix(api): improve validation handling and route schemas
  - `9137155` test(api): cover refresh and logout auth flow
  - `TODO` fix(api): add first ticket endpoints and smoke test
- [ ] Нужно при необходимости сделать следующий коммит после новых изменений

## Следующий шаг
- [x] Перейти к следующей задаче по плану после Sprint 1
- [x] Добавить smoke-тест перед реализацией следующего функционала
- [ ] Продолжить Sprint 2: список/детали/обновление заявок
