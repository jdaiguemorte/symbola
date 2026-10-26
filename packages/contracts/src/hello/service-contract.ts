// Interface du service.ts de hello (SOC-06) — pensée comme le futur
// contrat HTTP /v1/hello si ce module est extrait en app autonome (ADR
// 0011). apps/symbola vérifie que le vrai module satisfait ce type
// (test de contrat, voir apps/symbola/modules/hello/service.contract.test.ts).
export type Greeting = {
  message: string;
};

export type CreateGreetingInput = {
  organizationId: string;
  message: string;
};

export type CreateGreetingResult = {
  id: string;
  message: string;
};

export interface HelloServiceContract {
  getGreeting(): Greeting;
  createGreeting(input: CreateGreetingInput): Promise<CreateGreetingResult>;
}
