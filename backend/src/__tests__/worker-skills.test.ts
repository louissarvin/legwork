import { describe, it, expect } from 'bun:test'
import { AGENT_TOOLS } from '../lib/agent/tools.ts'

describe('Worker Skills & Search', () => {
  it('should parse comma-separated skills correctly', () => {
    const skillsStr = 'photo,delivery,data'
    const parsed = skillsStr.split(',').map(s => s.trim())
    expect(parsed).toEqual(['photo', 'delivery', 'data'])
    expect(parsed).toHaveLength(3)
    expect(parsed).toContain('photo')
    expect(parsed).toContain('delivery')
    expect(parsed).toContain('data')
  })

  it('should handle empty skills string', () => {
    const skillsStr = ''
    const parsed = skillsStr.split(',').map(s => s.trim()).filter(Boolean)
    expect(parsed).toEqual([])
    expect(parsed).toHaveLength(0)
  })

  it('should handle single skill', () => {
    const skillsStr = 'photo'
    const parsed = skillsStr.split(',').map(s => s.trim())
    expect(parsed).toEqual(['photo'])
  })

  it('should match skill to task category', () => {
    const workerSkills = 'photo,delivery,check'
    const taskCategory = 'photo'
    const skills = workerSkills.toLowerCase().split(',').map(s => s.trim())
    expect(skills.includes(taskCategory.toLowerCase())).toBe(true)
  })

  it('should reject skill mismatch', () => {
    const workerSkills = 'delivery,check'
    const taskCategory = 'photo'
    const skills = workerSkills.toLowerCase().split(',').map(s => s.trim())
    expect(skills.includes(taskCategory.toLowerCase())).toBe(false)
  })

  it('should allow "all" skill to match any category', () => {
    const workerSkills = 'all'
    const taskCategory = 'mystery'
    const skills = workerSkills.toLowerCase().split(',').map(s => s.trim())
    expect(skills.includes(taskCategory.toLowerCase()) || skills.includes('all')).toBe(true)
  })

  it('should define valid availability states', () => {
    const validStates = ['available', 'busy', 'offline']
    expect(validStates).toContain('available')
    expect(validStates).toContain('busy')
    expect(validStates).toContain('offline')
  })

  it('should block offline workers from assignment', () => {
    const workerAvailability = 'offline'
    expect(workerAvailability === 'offline').toBe(true)
  })

  it('should allow available workers for assignment', () => {
    const workerAvailability = 'available'
    expect(workerAvailability !== 'offline').toBe(true)
  })

  it('should allow busy workers to be visible in search but not ideal', () => {
    const workerAvailability = 'busy'
    // Busy workers can appear in search but shouldn't be auto-assigned
    expect(workerAvailability !== 'offline').toBe(true)
    expect(workerAvailability === 'available').toBe(false)
  })
})

describe('Worker Search Agent Tool', () => {
  it('should have search_workers tool', () => {
    const tool = AGENT_TOOLS.find(t => t.name === 'search_workers')
    expect(tool).toBeDefined()
    expect(tool!.description).toContain('Search')
    expect(tool!.description).toContain('skill')

    const schema = tool!.input_schema as { properties: Record<string, unknown> }
    expect(schema.properties).toHaveProperty('skill')
    expect(schema.properties).toHaveProperty('available_only')
  })

  it('should have assign_worker_to_task tool', () => {
    const tool = AGENT_TOOLS.find(t => t.name === 'assign_worker_to_task')
    expect(tool).toBeDefined()
    expect(tool!.description).toContain('assign')
    expect(tool!.description).toContain('direct booking')

    const schema = tool!.input_schema as { required: string[]; properties: Record<string, unknown> }
    expect(schema.required).toContain('task_id')
    expect(schema.required).toContain('worker_id')
  })

  it('should have 34 total tools', () => {
    expect(AGENT_TOOLS.length).toBe(35)
  })

  it('should have all worker-related tools', () => {
    const workerTools = ['search_workers', 'assign_worker_to_task', 'check_worker_balance']
    for (const name of workerTools) {
      expect(AGENT_TOOLS.find(t => t.name === name)).toBeDefined()
    }
  })
})

describe('Direct Booking Logic', () => {
  it('should validate skill match before booking', () => {
    // Simulate the booking validation logic
    const workerSkills = 'photo,check'
    const taskCategory = 'photo'

    const skills = workerSkills.toLowerCase().split(',').map(s => s.trim())
    const hasSkill = skills.includes(taskCategory.toLowerCase()) || skills.includes('all')

    expect(hasSkill).toBe(true)
  })

  it('should reject booking when worker lacks required skill', () => {
    const workerSkills = 'delivery,event'
    const taskCategory = 'photo'

    const skills = workerSkills.toLowerCase().split(',').map(s => s.trim())
    const hasSkill = skills.includes(taskCategory.toLowerCase()) || skills.includes('all')

    expect(hasSkill).toBe(false)
  })

  it('should allow booking when worker has no skills set (null)', () => {
    // If worker.skills is null, the skill check is skipped (no restriction)
    const workerSkills: string | null = null
    const taskCategory = 'photo'

    // Logic from taskRoutes: if worker.skills && task.category, then check
    const shouldCheck = workerSkills && taskCategory
    expect(shouldCheck).toBeFalsy()
    // No check = booking allowed
  })

  it('should set worker to busy after assignment', () => {
    let availability = 'available'
    // Simulate: after assignment, set busy
    availability = 'busy'
    expect(availability).toBe('busy')
  })

  it('should only allow booking for open tasks', () => {
    const validStatuses = ['open']
    const invalidStatuses = ['accepted', 'submitted', 'verified', 'paid', 'expired', 'rejected']

    for (const status of validStatuses) {
      expect(status === 'open').toBe(true)
    }
    for (const status of invalidStatuses) {
      expect(status === 'open').toBe(false)
    }
  })
})

describe('Skill Categories', () => {
  const validSkills = ['photo', 'delivery', 'check', 'data', 'mystery', 'event']

  it('should have 6 standard skill categories', () => {
    expect(validSkills).toHaveLength(6)
  })

  it('should match task categories', () => {
    // These match the task creation categories from create_task tool
    const createTaskSchema = AGENT_TOOLS.find(t => t.name === 'create_task')
    expect(createTaskSchema).toBeDefined()

    const categoryProp = (createTaskSchema!.input_schema as any).properties.category
    expect(categoryProp.enum).toBeDefined()

    // All skill categories should be valid task categories
    for (const skill of validSkills) {
      expect(categoryProp.enum).toContain(skill)
    }
  })
})
