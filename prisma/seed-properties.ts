import {
  BankAccountType,
  BankSubType,
  BankType,
  PrismaClient,
  Property
} from '@prisma/client'
import { EncryptionUtil } from '../src/common/utils/encryption.util'

const prisma = new PrismaClient()

// Property name templates
const propertyTypes = [
  'Hotel',
  'Resort',
  'Inn',
  'Suites',
  'Lodge',
  'Plaza',
  'Grand Hotel',
  'Boutique Hotel',
  'Express',
  'Residence Inn'
]

const propertyPrefixes = [
  'Luxury',
  'Royal',
  'Grand',
  'Premium',
  'Elite',
  'Deluxe',
  'Comfort',
  'Executive',
  'Business',
  'Garden',
  'Ocean',
  'Mountain',
  'City',
  'Downtown',
  'Airport',
  'Riverside',
  'Beachfront',
  'Parkside',
  'Hillside',
  'Lakeside'
]

// US Cities with realistic addresses
const locations = [
  {
    city: 'New York',
    state: 'NY',
    streets: [
      'Broadway',
      '5th Avenue',
      'Park Avenue',
      'Madison Avenue',
      'Lexington Avenue'
    ]
  },
  {
    city: 'Los Angeles',
    state: 'CA',
    streets: [
      'Sunset Boulevard',
      'Wilshire Boulevard',
      'Hollywood Boulevard',
      'Rodeo Drive',
      'Venice Boulevard'
    ]
  },
  {
    city: 'Chicago',
    state: 'IL',
    streets: [
      'Michigan Avenue',
      'State Street',
      'Wacker Drive',
      'Lake Shore Drive',
      'Clark Street'
    ]
  },
  {
    city: 'Houston',
    state: 'TX',
    streets: [
      'Main Street',
      'Westheimer Road',
      'Richmond Avenue',
      'Kirby Drive',
      'Memorial Drive'
    ]
  },
  {
    city: 'Phoenix',
    state: 'AZ',
    streets: [
      'Central Avenue',
      'Camelback Road',
      'Indian School Road',
      'Thomas Road',
      'McDowell Road'
    ]
  },
  {
    city: 'Philadelphia',
    state: 'PA',
    streets: [
      'Market Street',
      'Broad Street',
      'Chestnut Street',
      'Walnut Street',
      'Arch Street'
    ]
  },
  {
    city: 'San Antonio',
    state: 'TX',
    streets: [
      'Broadway',
      "St Mary's Street",
      'Commerce Street',
      'Houston Street',
      'Alamo Plaza'
    ]
  },
  {
    city: 'San Diego',
    state: 'CA',
    streets: [
      'Harbor Drive',
      'Broadway',
      'India Street',
      'Pacific Highway',
      'Mission Boulevard'
    ]
  },
  {
    city: 'Dallas',
    state: 'TX',
    streets: [
      'Elm Street',
      'Commerce Street',
      'Main Street',
      'Ross Avenue',
      'McKinney Avenue'
    ]
  },
  {
    city: 'San Jose',
    state: 'CA',
    streets: [
      'First Street',
      'Santa Clara Street',
      'Market Street',
      'San Carlos Street',
      'Park Avenue'
    ]
  },
  {
    city: 'Austin',
    state: 'TX',
    streets: [
      'Congress Avenue',
      '6th Street',
      'Lamar Boulevard',
      'Guadalupe Street',
      'South Congress'
    ]
  },
  {
    city: 'Jacksonville',
    state: 'FL',
    streets: [
      'Bay Street',
      'Main Street',
      'Ocean Boulevard',
      'Atlantic Boulevard',
      'Beach Boulevard'
    ]
  },
  {
    city: 'Fort Worth',
    state: 'TX',
    streets: [
      'Main Street',
      'Houston Street',
      'Commerce Street',
      'Throckmorton Street',
      '7th Street'
    ]
  },
  {
    city: 'Columbus',
    state: 'OH',
    streets: [
      'High Street',
      'Broad Street',
      'Main Street',
      'Spring Street',
      'Long Street'
    ]
  },
  {
    city: 'Charlotte',
    state: 'NC',
    streets: [
      'Tryon Street',
      'Trade Street',
      'College Street',
      'Church Street',
      'Graham Street'
    ]
  },
  {
    city: 'San Francisco',
    state: 'CA',
    streets: [
      'Market Street',
      'Mission Street',
      'Van Ness Avenue',
      'Geary Boulevard',
      'Lombard Street'
    ]
  },
  {
    city: 'Indianapolis',
    state: 'IN',
    streets: [
      'Meridian Street',
      'Washington Street',
      'Market Street',
      'Pennsylvania Street',
      'Capitol Avenue'
    ]
  },
  {
    city: 'Seattle',
    state: 'WA',
    streets: [
      'Pike Street',
      'Pine Street',
      'Madison Street',
      '1st Avenue',
      'Broadway'
    ]
  },
  {
    city: 'Denver',
    state: 'CO',
    streets: [
      '16th Street',
      'Colfax Avenue',
      'Broadway',
      'Speer Boulevard',
      'Colorado Boulevard'
    ]
  },
  {
    city: 'Boston',
    state: 'MA',
    streets: [
      'Boylston Street',
      'Newbury Street',
      'Commonwealth Avenue',
      'Beacon Street',
      'Tremont Street'
    ]
  },
  {
    city: 'Nashville',
    state: 'TN',
    streets: [
      'Broadway',
      'Music Row',
      'West End Avenue',
      'Charlotte Avenue',
      'Church Street'
    ]
  },
  {
    city: 'Baltimore',
    state: 'MD',
    streets: [
      'Pratt Street',
      'Charles Street',
      'Light Street',
      'Baltimore Street',
      'North Avenue'
    ]
  },
  {
    city: 'Las Vegas',
    state: 'NV',
    streets: [
      'Las Vegas Boulevard',
      'Fremont Street',
      'Paradise Road',
      'Tropicana Avenue',
      'Flamingo Road'
    ]
  },
  {
    city: 'Portland',
    state: 'OR',
    streets: [
      'Burnside Street',
      'Broadway',
      'Morrison Street',
      'Hawthorne Boulevard',
      'Powell Boulevard'
    ]
  },
  {
    city: 'Miami',
    state: 'FL',
    streets: [
      'Biscayne Boulevard',
      'Collins Avenue',
      'Ocean Drive',
      'Flagler Street',
      'Miracle Mile'
    ]
  }
]

// Helper functions
function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getRandomFutureDate(maxDays = 90): Date {
  const date = new Date()
  date.setDate(date.getDate() + getRandomNumber(1, maxDays))
  return date
}

function generatePropertyName(index: number): string {
  const prefix = getRandomElement(propertyPrefixes)
  const type = getRandomElement(propertyTypes)
  const location = getRandomElement(locations)
  return `${prefix} ${location.city} ${type} ${index}`
}

function generateAddress(): string {
  const location = getRandomElement(locations)
  const street = getRandomElement(location.streets)
  const number = getRandomNumber(100, 9999)
  const zip = getRandomNumber(10000, 99999)
  return `${number} ${street}, ${location.city}, ${location.state} ${zip}`
}

function generateExpediaId(): string {
  return `EXP-${getRandomNumber(100000, 999999)}`
}

function generateOtaId(prefix: string): string {
  return `${prefix}-${getRandomNumber(100000, 999999)}`
}

function generateUsername(propertyName: string, ota: string): string {
  const sanitized = propertyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .substring(0, 20)
  return `${ota}_${sanitized}_${getRandomNumber(100, 999)}`
}

// Encrypted password placeholder (in real scenario, use EncryptionUtil)
function generateEncryptedPassword(): string {
  const plainPassword = `TestPass${Math.random().toString(36).substring(2, 10)}!1`
  const encryptionSecret = process.env.JWT_ACCESS_SECRET || 'default-secret-key'
  return EncryptionUtil.encrypt(plainPassword, encryptionSecret)
}

function generateBankAccountNumber(): string {
  return getRandomNumber(1000000000, 9999999999).toString()
}

function generateRoutingNumber(): string {
  return getRandomNumber(100000000, 999999999).toString()
}

function generateSwiftBic(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let swift = ''
  for (let i = 0; i < 8; i++) {
    if (i < 4) {
      swift += letters.charAt(Math.floor(Math.random() * letters.length))
    } else {
      swift += getRandomNumber(0, 9)
    }
  }
  return swift
}

const bankNames = [
  'Chase Bank',
  'Bank of America',
  'Wells Fargo',
  'Citibank',
  'US Bank',
  'PNC Bank',
  'Capital One',
  'TD Bank',
  'Truist Bank',
  'Fifth Third Bank'
]

async function main() {
  console.log('Starting property seeding...')
  console.log('='.repeat(80))

  // 1. Fetch existing portfolios
  const portfolios = await prisma.portfolio.findMany({
    where: { is_active: true },
    include: { serviceType: true }
  })

  if (portfolios.length === 0) {
    console.error('❌ No portfolios found! Please run seed:portfolios first.')
    process.exit(1)
  }

  console.log(`✓ Found ${portfolios.length} active portfolios`)

  // 2. Ensure currencies exist
  const currencies = await Promise.all([
    prisma.currency.upsert({
      where: { code: 'USD' },
      update: {},
      create: {
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        is_active: true,
        order: 1
      }
    }),
    prisma.currency.upsert({
      where: { code: 'EUR' },
      update: {},
      create: {
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
        is_active: true,
        order: 2
      }
    }),
    prisma.currency.upsert({
      where: { code: 'GBP' },
      update: {},
      create: {
        code: 'GBP',
        name: 'British Pound',
        symbol: '£',
        is_active: true,
        order: 3
      }
    }),
    prisma.currency.upsert({
      where: { code: 'CAD' },
      update: {},
      create: {
        code: 'CAD',
        name: 'Canadian Dollar',
        symbol: 'C$',
        is_active: true,
        order: 4
      }
    })
  ])

  console.log(`✓ Ensured ${currencies.length} currencies exist`)

  // 3. Generate and create 150 properties
  const totalProperties = 150
  const createdProperties: Property[] = []
  const failedProperties: Array<{ name: string; error: string }> = []

  console.log(`\n📦 Creating ${totalProperties} properties...`)
  console.log('-'.repeat(80))

  // Distribute properties across portfolios
  const propertiesPerPortfolio = Math.floor(totalProperties / portfolios.length)
  const remainder = totalProperties % portfolios.length

  let propertyIndex = 1

  for (let i = 0; i < portfolios.length; i++) {
    const portfolio = portfolios[i]
    const numProperties = propertiesPerPortfolio + (i < remainder ? 1 : 0)

    console.log(`\n📁 ${portfolio.name} (${numProperties} properties)`)

    for (let j = 0; j < numProperties; j++) {
      const propertyName = generatePropertyName(propertyIndex)
      const address = generateAddress()
      const currency = getRandomElement(currencies)
      const isActive = Math.random() > 0.1 // 90% active

      try {
        // Create property
        const property = await prisma.property.create({
          data: {
            name: propertyName,
            address: address,
            currency_id: currency.id,
            portfolio_id: portfolio.id,
            is_active: isActive,
            card_descriptor: `${propertyName.substring(0, 22)}*`,
            next_due_date: isActive ? getRandomFutureDate() : null,
            show_in_portfolio: []
          }
        })

        // Create credentials for the property
        await prisma.propertyCredentials.create({
          data: {
            property_id: property.id,
            expedia_id: generateExpediaId(),
            expedia_username: generateUsername(propertyName, 'expedia'),
            expedia_password: generateEncryptedPassword(),
            agoda_id: Math.random() > 0.3 ? generateOtaId('AGO') : null,
            agoda_username:
              Math.random() > 0.3
                ? generateUsername(propertyName, 'agoda')
                : null,
            agoda_password:
              Math.random() > 0.3 ? generateEncryptedPassword() : null,
            booking_id: Math.random() > 0.2 ? generateOtaId('BOK') : null,
            booking_username:
              Math.random() > 0.2
                ? generateUsername(propertyName, 'booking')
                : null,
            booking_password:
              Math.random() > 0.2 ? generateEncryptedPassword() : null
          }
        })

        // Create bank details for the property (80% of properties have bank details)
        if (Math.random() > 0.2) {
          const bankType =
            Math.random() > 0.15 ? BankType.bank : BankType.stripe
          const isStripe = bankType === BankType.stripe

          await prisma.propertyBankDetails.create({
            data: {
              property_id: property.id,
              bank_type: bankType,
              bank_sub_type:
                !isStripe && Math.random() > 0.5
                  ? getRandomElement([
                      BankSubType.ach,
                      BankSubType.domestic_wire,
                      BankSubType.international_wire
                    ])
                  : null,
              hotel_portfolio_name: portfolio.name,
              beneficiary_name: !isStripe ? `${propertyName} LLC` : null,
              beneficiary_address: !isStripe ? address : null,
              account_number: !isStripe ? generateBankAccountNumber() : null,
              account_name: !isStripe ? propertyName : null,
              bank_name: !isStripe ? getRandomElement(bankNames) : null,
              bank_branch:
                !isStripe && Math.random() > 0.5
                  ? `Branch ${getRandomNumber(1, 500)}`
                  : null,
              iban_number:
                !isStripe && Math.random() > 0.4 ? generateSwiftBic() : null,
              swift_bic_number:
                !isStripe && Math.random() > 0.4 ? generateSwiftBic() : null,
              routing_number:
                !isStripe && Math.random() > 0.6
                  ? generateRoutingNumber()
                  : null,
              bank_account_type:
                !isStripe && Math.random() > 0.5
                  ? getRandomElement([
                      BankAccountType.checking,
                      BankAccountType.savings
                    ])
                  : null,
              currency: currency.code,
              stripe_account_email: isStripe
                ? `stripe+${property.id.substring(0, 8)}@example.com`
                : null,
              associated_user_id: null
            }
          })
        }

        createdProperties.push(property)
        process.stdout.write(
          `  ✓ ${propertyIndex}/${totalProperties} - ${propertyName}\r`
        )
      } catch (error) {
        failedProperties.push({
          name: propertyName,
          error: error.message
        })
        process.stdout.write(
          `  ✗ ${propertyIndex}/${totalProperties} - ${propertyName} (FAILED)\r`
        )
      }

      propertyIndex++
    }
  }

  console.log('\n\n' + '='.repeat(80))
  console.log('PROPERTY SEED SUMMARY')
  console.log('='.repeat(80))

  console.log(
    `\n✅ Successfully created: ${createdProperties.length} properties`
  )
  console.log(`❌ Failed: ${failedProperties.length} properties`)

  // Portfolio distribution
  console.log('\n📊 Distribution by Portfolio:')
  for (const portfolio of portfolios) {
    const count = createdProperties.filter(
      p => p.portfolio_id === portfolio.id
    ).length
    console.log(`  ${portfolio.name}: ${count} properties`)
  }

  // Currency distribution
  console.log('\n💰 Distribution by Currency:')
  for (const currency of currencies) {
    const count = createdProperties.filter(
      p => p.currency_id === currency.id
    ).length
    console.log(`  ${currency.code}: ${count} properties`)
  }

  // Status distribution
  const activeCount = createdProperties.filter(p => p.is_active).length
  const inactiveCount = createdProperties.length - activeCount
  console.log('\n📈 Status Distribution:')
  console.log(`  Active: ${activeCount} properties`)
  console.log(`  Inactive: ${inactiveCount} properties`)

  // Related data summary
  const credentialsCount = await prisma.propertyCredentials.count()
  const bankDetailsCount = await prisma.propertyBankDetails.count()
  console.log('\n🔗 Related Data Created:')
  console.log(`  Property Credentials: ${credentialsCount}`)
  console.log(`  Bank Details: ${bankDetailsCount}`)

  // Show failures if any
  if (failedProperties.length > 0) {
    console.log('\n⚠️  Failed Properties:')
    for (const failed of failedProperties) {
      console.log(`  - ${failed.name}: ${failed.error}`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('✅ Property seeding completed!')
  console.log('='.repeat(80))
}

main()
  .catch(e => {
    console.error('\n❌ Property seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
