/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  taskTitle?: string
  message?: string
  remindAt?: string
  taskUrl?: string
  recipientName?: string
  completeUrl?: string
  snoozeUrl?: string
}

const Email = ({
  taskTitle = 'Sua tarefa',
  message,
  remindAt,
  taskUrl,
  recipientName,
  completeUrl,
  snoozeUrl,
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Lembrete: {taskTitle}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>Altivus Compass</Text>
        </Section>
        <Heading style={h1}>🔔 Lembrete de tarefa</Heading>
        {recipientName ? (
          <Text style={text}>Olá, {recipientName}.</Text>
        ) : null}
        <Text style={text}>
          Você tem um lembrete para a tarefa:
        </Text>
        <Section style={card}>
          <Text style={taskTitleStyle}>{taskTitle}</Text>
          {message ? <Text style={msgText}>{message}</Text> : null}
          {remindAt ? (
            <Text style={meta}>
              Agendado para: <strong>{remindAt}</strong>
            </Text>
          ) : null}
        </Section>
        {(completeUrl || snoozeUrl) ? (
          <Section style={{ textAlign: 'center', margin: '20px 0 8px' }}>
            {completeUrl ? (
              <Button href={completeUrl} style={buttonPrimary}>
                ✅ Marcar concluída
              </Button>
            ) : null}
            {snoozeUrl ? (
              <Button href={snoozeUrl} style={buttonSecondary}>
                ⏰ Adiar 30 min
              </Button>
            ) : null}
          </Section>
        ) : null}
        {taskUrl ? (
          <Section style={{ textAlign: 'center', margin: '16px 0 8px' }}>
            <Button href={taskUrl} style={buttonGhost}>
              Abrir tarefa
            </Button>
          </Section>
        ) : null}
        <Text style={footer}>
          Você está recebendo este e-mail porque é o responsável por esta tarefa no Altivus Compass.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Props) =>
    `🔔 Lembrete: ${data?.taskTitle ?? 'Tarefa'}`,
  displayName: 'Lembrete de tarefa',
  previewData: {
    taskTitle: 'Confirmar reserva de hotel',
    message: 'Ligar para o cliente confirmando o check-in.',
    remindAt: '07/06/2026 09:00',
    taskUrl: 'https://compass.altivusturismo.com.br/tasks/123',
    recipientName: 'Maria',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'DM Sans', Arial, sans-serif",
  color: 'hsl(220, 40%, 13%)',
}
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const header = { borderBottom: '1px solid hsl(220, 15%, 90%)', paddingBottom: '12px', marginBottom: '24px' }
const brand = { fontFamily: "'Playfair Display', Georgia, serif", fontSize: '20px', fontWeight: 600, color: 'hsl(220, 60%, 18%)', margin: 0 }
const h1 = { fontFamily: "'Playfair Display', Georgia, serif", fontSize: '24px', color: 'hsl(220, 40%, 13%)', margin: '0 0 12px' }
const text = { fontSize: '15px', lineHeight: '1.6', color: 'hsl(220, 10%, 35%)' }
const card = { backgroundColor: 'hsl(220, 20%, 97%)', border: '1px solid hsl(220, 15%, 90%)', borderRadius: '8px', padding: '16px 20px', margin: '16px 0' }
const taskTitleStyle = { fontSize: '17px', fontWeight: 600, color: 'hsl(220, 40%, 13%)', margin: '0 0 8px' }
const msgText = { fontSize: '14px', lineHeight: '1.5', color: 'hsl(220, 10%, 35%)', margin: '8px 0' }
const meta = { fontSize: '13px', color: 'hsl(220, 10%, 50%)', margin: '8px 0 0' }
const buttonPrimary = { backgroundColor: 'hsl(142, 70%, 32%)', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600, display: 'inline-block', margin: '0 6px 8px' }
const buttonSecondary = { backgroundColor: 'hsl(220, 60%, 18%)', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600, display: 'inline-block', margin: '0 6px 8px' }
const buttonGhost = { backgroundColor: 'hsl(220, 20%, 95%)', color: 'hsl(220, 60%, 18%)', padding: '10px 22px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 500, display: 'inline-block' }
const footer = { fontSize: '12px', color: 'hsl(220, 10%, 50%)', marginTop: '24px', lineHeight: '1.5' }
