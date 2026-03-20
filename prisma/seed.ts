import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding simulation scenarios...')

  const scenarios = [
    {
      title: 'Duplicate Recharge Deduction',
      category: 'Billing',
      difficulty: 'Easy',
      description: 'Customer was charged twice for the same plan after a payment failure.',
      scriptJson: JSON.stringify([
        { speaker: 'customer', text: 'Hi, I noticed two charges on my account for the same data pack.' },
        { speaker: 'agent_ai', text: 'I apologize for the confusion. Let me check your transaction history.' },
        { speaker: 'customer', text: 'It says "Successful" for both, but I only bought it once.' }
      ])
    },
    {
      title: 'Network Outage in Downtown',
      category: 'Technical',
      difficulty: 'Medium',
      description: 'Customer reporting intermittent data connectivity in a specific urban zone.',
      scriptJson: JSON.stringify([
        { speaker: 'customer', text: 'My internet keeps cutting out in the city center. It\'s been happening all day.' },
        { speaker: 'agent_ai', text: 'I\'m sorry for the connectivity issues. Let me run a diagnostic on the local towers.' },
        { speaker: 'customer', text: 'I need this fixed, I have an important meeting soon.' }
      ])
    },
    {
      title: 'Cancellation Threat - Porting Out',
      category: 'Retentions',
      difficulty: 'Hard',
      description: 'Long-term customer threatening to switch to a competitor for a better price.',
      scriptJson: JSON.stringify([
        { speaker: 'customer', text: 'I want to port my number to GlobalTel. Their monthly plan is $20 cheaper.' },
        { speaker: 'agent_ai', text: 'We value your 5-year loyalty. Before you decide, let me see what exclusive offers I have for you.' },
        { speaker: 'customer', text: 'It better be good, otherwise I\'m leaving today.' }
      ])
    }
  ]

  for (const scenario of scenarios) {
    await prisma.simulationScenario.create({
      data: scenario
    })
  }

  console.log('✅ Seeding complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
