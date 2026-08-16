import Empty from "@/components/Empty";

export default function NotFound() {
    return (
        <Empty
            title="Page not found"
            body="That URL doesn't match anything here."
            actionLabel="Back to feed"
            actionHref="/"
        />
    );
}
