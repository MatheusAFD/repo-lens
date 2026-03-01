import { Module } from '@nestjs/common'
import { AnalysisController } from './analysis.controller'
import { AnalysisService } from './analysis.service'
import { ContextBuilderService } from './context-builder.service'
import { PromptBuilderService } from './prompt-builder.service'
import { GithubModule } from '../github/github.module'
import { ReposModule } from '../repos/repos.module'

@Module({
  imports: [GithubModule, ReposModule],
  controllers: [AnalysisController],
  providers: [AnalysisService, ContextBuilderService, PromptBuilderService],
})
export class AnalysisModule {}
