export class UserEntity {
  constructor(readonly id: string, readonly email: string, readonly displayName: string, readonly isPlatformAdmin: boolean) {}
}
