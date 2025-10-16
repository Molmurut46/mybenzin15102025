# Руководство по созданию Android APK

Этот проект поддерживает два способа создания Android приложения:

## 🚀 Способ 1: Capacitor (Рекомендуется для нативных возможностей)

Capacitor превращает Next.js приложение в полноценное нативное Android приложение.

### Преимущества:
- ✅ Полный доступ к нативным API Android
- ✅ Работает офлайн (если настроить)
- ✅ Лучшая производительность
- ✅ Нативный вид и ощущения

### Автоматическая сборка через GitHub Actions:

1. **Загрузите проект на GitHub:**
   - Используйте страницу `/app` для синхронизации
   - Или вручную: `git push origin main`

2. **Запустите workflow:**
   - Перейдите в GitHub → Actions → "Build Android APK with Capacitor"
   - Нажмите "Run workflow"
   - Дождитесь завершения сборки (~5-10 минут)

3. **Скачайте APK:**
   - Артефакт `mybenzin-app` появится внизу страницы workflow
   - Или используйте кнопку "Скачать APK" на странице `/app`

### Локальная разработка:

```bash
# 1. Установите зависимости
npm install

# 2. Соберите Next.js приложение
npm run build

# 3. Добавьте Android платформу (первый раз)
npx cap add android

# 4. Синхронизируйте код с Android проектом
npx cap sync android

# 5. Откройте Android Studio
npx cap open android

# 6. В Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s)
```

### Настройка Capacitor:

Файл `capacitor.config.ts` уже настроен. Вы можете изменить:

```typescript
{
  appId: 'com.mybenzin.app',        // ID приложения
  appName: 'Mybenzin',               // Имя приложения
  webDir: 'out',                     // Папка билда
  server: {
    url: 'https://ваш-сайт.com',    // URL развернутого сайта
  }
}
```

## 🌐 Способ 2: TWA (Trusted Web Activity) с Bubblewrap

TWA упаковывает веб-сайт в Android приложение без изменения кода.

### Преимущества:
- ✅ Быстрая настройка
- ✅ Нет необходимости в билде Next.js
- ✅ Автоматические обновления (через сайт)
- ✅ Меньший размер APK

### Автоматическая сборка через GitHub Actions:

1. **Загрузите проект на GitHub**

2. **Запустите workflow:**
   - GitHub → Actions → "CI" (main.yml)
   - "Run workflow"
   - Укажите URL сайта: `https://mybenzin.vercel.app`
   - Дождитесь сборки

3. **Скачайте APK:**
   - Артефакт `mybenzin-android-apk`

### Требования для TWA:

Ваш сайт должен иметь:
- ✅ HTTPS соединение
- ✅ Файл `/manifest.json` (web app manifest)
- ✅ Иконку `/icon-512.png`
- ✅ PWA конфигурация

## 📱 Какой способ выбрать?

### Выбирайте Capacitor если:
- Нужны нативные функции (камера, геолокация, push уведомления)
- Требуется офлайн режим
- Важна производительность

### Выбирайте TWA если:
- Просто нужно упаковать сайт в APK
- Хотите автоматические обновления через сайт
- Не нужны нативные функции

## 🔧 Настройка для страницы /app

Страница управления `/app` автоматически определяет доступные workflows:

1. **android-capacitor.yml** → Сборка через Capacitor
2. **main.yml** → Сборка через TWA/Bubblewrap

Настройте в `.env`:

```env
# Для Capacitor workflow
GITHUB_WORKFLOW_ID=android-capacitor.yml

# Или для TWA workflow
GITHUB_WORKFLOW_ID=main.yml
```

## 📦 Подпись APK для Google Play

Для публикации в Google Play нужно подписать APK:

1. **Создайте keystore:**
```bash
keytool -genkey -v -keystore mybenzin.keystore \
  -alias mybenzin -keyalg RSA -keysize 2048 -validity 10000
```

2. **Добавьте секреты в GitHub:**
   - `KEYSTORE_FILE` (base64 закодированный keystore)
   - `KEYSTORE_PASSWORD`
   - `KEY_ALIAS`
   - `KEY_PASSWORD`

3. Workflow автоматически подпишет APK

## 🐛 Решение проблем

### APK не собирается
- Проверьте логи в GitHub Actions
- Убедитесь, что все переменные окружения настроены
- Проверьте, что сайт доступен (для TWA)

### APK слишком большой
- Используйте TWA вместо Capacitor
- Оптимизируйте ассеты
- Используйте AAB (Android App Bundle) вместо APK

### Приложение не открывается
- Проверьте URL в capacitor.config.ts
- Убедитесь, что сайт работает
- Проверьте логи Android (adb logcat)

## 📚 Дополнительные ресурсы

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Bubblewrap Documentation](https://github.com/GoogleChromeLabs/bubblewrap)
- [Android Developer Guide](https://developer.android.com/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

## 🎯 Быстрый старт

Хотите просто получить APK прямо сейчас?

1. Зайдите на `/app`
2. Нажмите "Синхронизировать с GitHub"
3. Нажмите "Запустить сборку"
4. Дождитесь 5-10 минут
5. Скачайте APK через кнопку "Скачать APK"

Готово! 🎉