export class SmsSendEvent {
  constructor(
    public readonly phoneNumber: string,
    public readonly message?: string,
    public readonly templateName?: string,
    public readonly templateVariables?: Record<string, any>,
    public readonly organization?: string,
    public readonly partnerId?: string,
  ) {}
}
