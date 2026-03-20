import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding high-impact demo data...')

  // 1. High-Impact Scenarios
  const scenarios = [
    {
      title: 'Policy Restricted Refund',
      category: 'Billing',
      difficulty: 'Expert',
      description: 'Customer demanding a $200 refund for a missed technician visit.',
      scriptJson: JSON.stringify([
        { speaker: 'customer', text: 'The technician never showed up. It cost me a full day of work. I want a $200 credit immediately.' },
        { speaker: 'agent_ai', text: 'I sincerely apologize. Let me check our credit limits and verify the appointment status.' },
        { speaker: 'customer', text: 'I don\'t care about your limits. Either give me $200 or I\'ll sue the company.' }
      ])
    },
    {
      title: 'Repeated Connectivity Failure',
      category: 'Technical',
      difficulty: 'Hard',
      description: 'Third call this week about the same issue. High churn risk.',
      scriptJson: JSON.stringify([
        { speaker: 'customer', text: 'This is my third time calling! My data is still not working. This is useless.' },
        { speaker: 'agent_ai', text: 'I can see your previous two tickets. I\'m so sorry they weren\'t resolved. This is being prioritized.' },
        { speaker: 'customer', text: 'I want to speak to a manager. This is ridiculous.' }
      ])
    }
  ]

  for (const scenario of scenarios) {
    await prisma.simulationScenario.create({ data: scenario })
  }

  // 2. Customers with Memory
  await prisma.customer.upsert({
     where: { phoneNumber: '555-0101' },
     update: {},
     create: {
       name: 'Robert Vance',
       phoneNumber: '555-0101',
       planType: 'Standard Mobile',
       region: 'Pacific',
       totalComplaints: 5,
       churnRisk: 85.0,
       vipStatus: false,
       lastSentiment: 'Frustrated',
       sessions: {
          create: {
             channelType: 'voice',
             status: 'completed',
             memoryItems: {
                createMany: {
                   data: [
                      { memoryText: 'Customer mentioned moving to a different state soon.', memoryType: 'Retention Risk' },
                      { memoryText: 'Loves the 5G data speed when it works.', memoryType: 'Preference' }
                   ]
                }
             }
          }
       }
     }
  });

  await prisma.customer.upsert({
    where: { phoneNumber: '555-0999' },
    update: {},
    create: {
      name: 'Sarah Connor',
      phoneNumber: '555-0999',
      planType: 'Elite Corporate',
      region: 'Central',
      totalComplaints: 1,
      churnRisk: 5.0,
      vipStatus: true,
      lastSentiment: 'Neutral',
    }
 });

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
