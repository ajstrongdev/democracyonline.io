import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/parties/manage/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/parties/manage/$id"!</div>
}
