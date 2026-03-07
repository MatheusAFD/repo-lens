import { Module } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import { AuthModule } from '@thallesp/nestjs-better-auth'
import { auth } from './auth/auth'
import { AppController } from './app.controller'
import { SessionsModule } from './modules/sessions/sessions.module'
import { GithubModule } from './modules/github/github.module'
import { ReposModule } from './modules/repos/repos.module'
import { AnalysisModule } from './modules/analysis/analysis.module'

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'analysis',
        ttl: 60_000,
        limit: 5,
      },
    ]),
    AuthModule.forRoot({ auth }),
    SessionsModule,
    GithubModule,
    ReposModule,
    AnalysisModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
