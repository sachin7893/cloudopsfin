# Product Overview

Cloud Management Dashboard - A unified platform for FinOps and CloudOps management.

## Purpose

Provides visibility and control over AWS cloud infrastructure costs and operations through two main views:

- **FinOps View**: Cost analysis, trend visualization, and AI-powered chat copilot for financial optimization
- **CloudOps View**: Resource management for EC2 instances, EKS clusters, and ECS services

## Key Features

- Yearly cost trend visualization with monthly breakdowns
- Month-over-month cost increase analysis by service
- Interactive chat interface with memory-based context for cost queries
- EC2 instance start/stop/schedule controls
- EKS cluster suspension for cost savings
- ECS service monitoring

## Backend Integration

- REST API hosted on AWS API Gateway (ap-south-1 region)
- Endpoints: `/finops`, `/top-increase`, `/chat`
- Chat API supports memory management for contextual conversations
