export interface SubTaskData {
  id: string
  name: string
  completed: boolean
  createdAt: Date
}

export interface TimerData {
  id: string
  name: string
  endDate: Date
  type: "till" | "from"
  completed?: boolean
  createdAt: Date
  subTasks?: SubTaskData[]
  description?: string
}
