import nodemailer from 'nodemailer';

// Create reusable transporter for Yandex Mail
const transporter = nodemailer.createTransport({
  host: 'smtp.yandex.ru',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendWelcomeEmail(to: string, name: string) {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, '')
  
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject: "Добро пожаловать в систему отчётов!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Добро пожаловать, ${name}!</h2>
          <p>Ваш аккаунт успешно создан в системе формирования отчётов по расходу топлива.</p>
          <p>Теперь вы можете:</p>
          <ul style="color: #666;">
            <li>Создавать отчёты по расходу топлива</li>
            <li>Отслеживать пробег и маршруты</li>
            <li>Экспортировать отчёты в Excel и PDF</li>
          </ul>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${baseUrl}/dashboard" 
               style="background-color: #2563eb; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Перейти в личный кабинет
            </a>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Если у вас возникнут вопросы, свяжитесь с нами.
          </p>
        </div>
      `,
    })

    console.log("Welcome email sent:", info.messageId)
    return { success: true }
  } catch (error) {
    console.error("Welcome email send error:", error)
    throw error
  }
}

export async function sendPasswordEmail(to: string, password: string, name: string) {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject: "Ваш пароль для входа в систему",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Добро пожаловать, ${name}!</h2>
          <p>Ваш аккаунт успешно создан. Ваш пароль для входа:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <code style="font-size: 16px; font-weight: bold;">${password}</code>
          </div>
          <p style="color: #666;">Рекомендуем сохранить этот пароль в надёжном месте.</p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Если вы не регистрировались в нашей системе, проигнорируйте это письмо.
          </p>
        </div>
      `,
    })

    console.log("Email sent:", info.messageId)
    return { success: true }
  } catch (error) {
    console.error("Email send error:", error)
    throw error
  }
}

export async function sendPasswordResetEmail(to: string, resetToken: string, name?: string) {
  // Remove trailing slash to prevent double slashes in URL
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, '')
  const resetUrl = `${baseUrl}/reset-password/${resetToken}`

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject: "Восстановление пароля",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Восстановление пароля</h2>
          ${name ? `<p>Здравствуйте, ${name}!</p>` : ''}
          <p>Вы запросили восстановление пароля. Нажмите на кнопку ниже, чтобы создать новый пароль:</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${resetUrl}" 
               style="background-color: #000; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Сбросить пароль
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            Или скопируйте и вставьте эту ссылку в браузер:
          </p>
          <p style="color: #666; font-size: 14px; word-break: break-all;">
            ${resetUrl}
          </p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Ссылка действительна в течение 1 часа.
          </p>
          <p style="color: #666; font-size: 14px;">
            Если вы не запрашивали восстановление пароля, проигнорируйте это письмо.
          </p>
        </div>
      `,
    })

    console.log("Password reset email sent:", info.messageId)
    return { success: true }
  } catch (error) {
    console.error("Password reset email error:", error)
    throw error
  }
}