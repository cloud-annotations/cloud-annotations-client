import React, { useState, useEffect, useCallback } from 'react'
import GoogleAnalytics from 'react-ga'
import { connect } from 'react-redux'
import { loadBuckets } from 'redux/buckets'

import Table from './TableV2'
import CreateModal from './CreateModal'
import DeleteModal from './DeleteModal'
import DropDown, { ProfileDropDown } from 'common/DropDown/DropDown'
import COS from 'api/COSv2'
import { defaultEndpoint } from 'endpoints'

import history from 'globalHistory'
import styles from './Buckets.module.css'
import { setResources } from 'redux/resources'
import { setAccounts } from 'redux/accounts'
import { useGoogleAnalytics } from 'googleAnalyticsHook'

const accountNameForAccount = account => {
  if (account && account.softlayer) {
    return `${account.softlayer} - ${account.name}`
  } else if (account) {
    return account.name
  }
}

const Buckets = ({
  profile,
  buckets,
  resources,
  activeResource,
  accounts,
  activeAccount,
  dispatch
}) => {
  const [isCreateBucketModalOpen, setIsCreateBucketModalOpen] = useState(false)
  const [bucketToDelete, setBucketToDelete] = useState(false)
  const [loading, setLoading] = useState(false)

  const [listOfLoadingBuckets, setListOfLoadingBuckets] = useState([])

  const dispatchLoadBuckets = useCallback(
    async chosenInstance => {
      try {
        // We only want to show the loading indicator when we first load the
        // page. Don't `setLoading(true)`
        dispatch(await loadBuckets(chosenInstance))
        setLoading(false)
      } catch (error) {
        console.error(error)
      }
    },
    [dispatch]
  )

  useGoogleAnalytics('buckets')

  useEffect(() => {
    // Loading until activeResource is ready.
    if (!buckets) {
      setLoading(true)
    }
  }, [buckets])

  useEffect(() => {
    if (activeResource) {
      dispatchLoadBuckets(activeResource)
    }
  }, [activeResource, dispatchLoadBuckets])

  const handleRowSelected = useCallback(
    id => {
      const bucket = buckets.filter(bucket => bucket.id === id)[0]
      history.push(`/${bucket.name}?location=${bucket.location}`)
    },
    [buckets]
  )

  const handleCreateBucket = useCallback(() => {
    setIsCreateBucketModalOpen(true)
  }, [])

  const handleCloseCreateModal = useCallback(() => {
    setIsCreateBucketModalOpen(false)
  }, [])

  const handleSubmitCreateModal = useCallback(
    bucketName => {
      dispatchLoadBuckets(activeResource)
      setIsCreateBucketModalOpen(false)
      history.push(`/${bucketName}?location=us`)
    },
    [activeResource, dispatchLoadBuckets]
  )

  const handleDeleteBucket = useCallback(bucketName => {
    setBucketToDelete(bucketName)
  }, [])

  const handleCloseDeleteModal = useCallback(() => {
    setBucketToDelete(false)
  }, [])

  const handleSubmitDeleteModal = useCallback(
    async bucketName => {
      setBucketToDelete(false)
      setListOfLoadingBuckets(list => [...list, bucketName])
      try {
        const cos = new COS({ endpoint: defaultEndpoint })

        // Recursively delete 1000 objects at time.
        const deleteAllObjects = async () => {
          const res = await cos.listObjectsV2({ Bucket: bucketName })
          const { Contents = [] } = res.ListBucketResult
          const contents = Array.isArray(Contents) ? Contents : [Contents]
          const objects = contents.map(item => ({ Key: item.Key }))
          if (objects.length > 0) {
            await cos.deleteObjects({
              Bucket: bucketName,
              Delete: {
                Objects: objects
              }
            })
            await deleteAllObjects()
          }
          return
        }

        await deleteAllObjects()

        await cos.deleteBucket({
          Bucket: bucketName
        })
      } catch (error) {
        console.error(error)
      }
      await dispatchLoadBuckets(activeResource)
      setListOfLoadingBuckets(list => list.filter(b => b !== bucketName))
    },
    [activeResource, dispatchLoadBuckets]
  )

  const handleAccountChosen = useCallback(
    item => {
      const activeAccount = accounts.find(
        account => accountNameForAccount(account) === item
      ).accountId
      dispatch(
        setAccounts({
          accounts: accounts,
          activeAccount: activeAccount
        })
      )
    },
    [accounts, dispatch]
  )

  const handleResourceChosen = useCallback(
    item => {
      const activeResource = resources.find(resource => resource.name === item)
        .id
      dispatch(
        setResources({
          resources: resources,
          activeResource: activeResource
        })
      )
    },
    [dispatch, resources]
  )

  const activeAccountObject = accounts.find(
    account => activeAccount === account.accountId
  )

  const activeResourceObject = resources.find(
    resource => activeResource === resource.id
  )

  return (
    <div className={styles.wrapper}>
      <div className={styles.titleBar}>
        <div className={styles.title}>
          <span className={styles.titlePrefix}>IBM</span>&nbsp;&nbsp;Cloud
          Annotations
        </div>
        <DropDown
          active={activeResourceObject && activeResourceObject.name}
          list={resources.map(resource => resource.name)}
          onChosen={handleResourceChosen}
        />
        <DropDown
          active={accountNameForAccount(activeAccountObject)}
          list={accounts.map(account => accountNameForAccount(account))}
          onChosen={handleAccountChosen}
        />
        <ProfileDropDown profile={profile} />
      </div>
      <DeleteModal
        isOpen={bucketToDelete}
        onClose={handleCloseDeleteModal}
        onSubmit={handleSubmitDeleteModal}
        itemToDelete={bucketToDelete}
      />
      <CreateModal
        isOpen={isCreateBucketModalOpen}
        onClose={handleCloseCreateModal}
        onSubmit={handleSubmitCreateModal}
        instanceId={activeResource}
      />
      <Table
        buckets={buckets}
        listOfLoadingBuckets={listOfLoadingBuckets}
        onDeleteBucket={handleDeleteBucket}
        onCreateBucket={handleCreateBucket}
        onRowSelected={handleRowSelected}
        loading={loading}
      />
    </div>
  )
}

const mapStateToProps = state => ({
  resources: state.resources.resources,
  activeResource: state.resources.activeResource,
  accounts: state.accounts.accounts,
  activeAccount: state.accounts.activeAccount,
  buckets: state.buckets,
  profile: state.profile
})
export default connect(mapStateToProps)(Buckets)
